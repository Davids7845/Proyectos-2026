// ORD 2 — Adiciones (producto: CALIZA PARA ADICIONES)
//
// Componentes: MP (Caliza Triturada) + Energía + Barras y Placas +
//              Material Dique + Desmantelamiento + Regalías.
//
// El precio de la caliza se evalúa igual que ORD 1:
//   precio_caliza_martillo = COSTO_CALIZA_MARTILLO_v1(caliza, martillo, pct_caliza, pct_martillo)
// usando porcentajes_consumo del material CALTLVTRIT (proveedor "caliza" / "martillo").

import { fn as calcMezcla }          from "@/lib/calc/formulas/costo_mezcla_ponderada";
import { fn as calcCalizaMartillo }  from "@/lib/calc/formulas/costo_caliza_martillo";
import { logComponentesAuxiliares, produccionNormalizada, writeMovimientosMp }  from "./_componentes_proceso";
import type {
  CalcWriter,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
  Periodo,
  CalcContext,
  UUID,
} from "@/lib/calc/engine/context";

const CODIGOS_CALIZA_PRIORIDAD  = ["CALIZATRI", "CALTLVTRIT"];
const CODIGO_MARTILLO_PROVEEDOR = "martillo";

export class Ord02Adiciones implements ProcesoCalculator {
  ord = 2;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    const { ctx, proceso, periodo, writer } = args;

    // ─── Fase 2b: Modo "Sin Consolidar" ─────────────────────────────
    const precioFijo = ctx.preciosFijos
      ? ctx.preciosFijosByKey?.get(`${proceso.id}|${periodo}`)
      : undefined;
    if (precioFijo != null) {
      const fijoId = await writer.log({
        calculo_tipo: "costo_proceso_total",
        proceso_id: proceso.id,
        periodo,
        concepto: `Costo total proceso (precio fijo) — ${proceso.nombre}`,
        valor_resultado: precioFijo,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `precio_fijo=${precioFijo} (Modo Sin Consolidar)`,
        parametros_entrada: { precio_fijo: precioFijo, modo: "sin_consolidar" },
        nivel_jerarquia: 0,
      });
      return {
        proceso_id: proceso.id,
        periodo,
        costo_materia_prima: precioFijo,
        costo_combustible:   null,
        costo_energia:       null,
        costo_repuestos:     null,
        costo_servicios:     null,
        costo_total: precioFijo,
        costo_por_ton: precioFijo,
        costo_recibido_arrastre:  0,
        costo_total_arrastrado:   precioFijo,
        costo_por_ton_arrastrado: precioFijo,
        calc_total_id: fijoId,
      };
    }

    // Busca el material caliza (CALIZATRI o CALTLVTRIT).
    let mat: { id: string; nombre: string; codigo: string } | undefined;
    for (const codigo of CODIGOS_CALIZA_PRIORIDAD) {
      mat = ctx.materialesByCodigo.get(codigo);
      if (mat && ctx.preciosByMatPeriodo.has(`${mat.id}|${periodo}|`)) break;
    }
    if (!mat) {
      throw new Error(`ORD2 ${periodo}: falta material caliza (probó ${CODIGOS_CALIZA_PRIORIDAD.join(", ")})`);
    }

    // ─── 1) Precio Caliza + Martillo (igual que ORD1) ──────────────────
    // El precio real de la caliza incluye el costo del martillo ponderado por
    // el % de consumo (fila 129-130 hoja Datos). Usar el precio plano daría
    // 13,819 en vez del correcto 13,978 (= 13,819×0.95 + (13,819+3,178)×0.05).
    const precioCaliza   = ctx.preciosByMatPeriodo.get(`${mat.id}|${periodo}|`);
    const precioMartillo = ctx.preciosByMatPeriodo.get(`${mat.id}|${periodo}|${CODIGO_MARTILLO_PROVEEDOR}`);
    const pctCaliza      = ctx.pctConsumoByKey.get(`${mat.id}|${periodo}|caliza`);
    const pctMartillo    = ctx.pctConsumoByKey.get(`${mat.id}|${periodo}|martillo`);

    if (!precioCaliza) {
      throw new Error(`ORD2 ${periodo}: falta precio de caliza (${mat.codigo})`);
    }

    let precioMP: number;
    let mpCalcId: string;

    if (precioMartillo && pctCaliza && pctMartillo) {
      const f1 = calcCalizaMartillo({
        precio_caliza:  precioCaliza.precio,
        costo_martillo: precioMartillo.precio,
        pct_caliza:     pctCaliza.porcentaje,
        pct_martillo:   pctMartillo.porcentaje,
      });
      precioMP = f1.valor;
      mpCalcId = await writer.log({
        calculo_tipo: "precio_caliza_martillo",
        proceso_id: proceso.id,
        material_id: mat.id,
        periodo,
        concepto: "Precio Caliza + Martillo ponderado (Adiciones)",
        valor_resultado: f1.valor,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_CALIZA_MARTILLO_v1",
        formula_expresion: f1.expresion_evaluada,
        parametros_entrada: {
          precio_caliza: precioCaliza.precio,
          costo_martillo: precioMartillo.precio,
          pct_caliza: pctCaliza.porcentaje,
          pct_martillo: pctMartillo.porcentaje,
        },
        nivel_jerarquia: 2,
      });
    } else {
      // Sin datos de martillo: usar precio plano (fallback compatible)
      precioMP = precioCaliza.precio;
      mpCalcId = await writer.log({
        calculo_tipo: "precio_caliza_martillo",
        proceso_id: proceso.id,
        material_id: mat.id,
        periodo,
        concepto: "Precio Caliza (sin datos martillo, precio plano)",
        valor_resultado: precioMP,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_MEZCLA_PONDERADA_v1",
        formula_expresion: `precio_plano=${precioMP}`,
        parametros_entrada: { precio_plano: precioMP },
        nivel_jerarquia: 2,
      });
    }

    // ─── 2) Costo MP adiciones (100% caliza+martillo) ──────────────────
    const mpItems = [{ nombre: mat.nombre, precio: precioMP, pct: 1.0 }];
    const f = calcMezcla({ items_json: JSON.stringify(mpItems) });

    const mpId = await writer.log({
      calculo_tipo: "costo_mp_adiciones",
      proceso_id: proceso.id,
      material_id: mat.id,
      periodo,
      concepto: "Costo Materia Prima — Adiciones",
      valor_resultado: f.valor,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_MEZCLA_PONDERADA_v1",
      formula_expresion: f.expresion_evaluada,
      parametros_entrada: { items: mpItems },
      nivel_jerarquia: 1,
      depende_de: [mpCalcId],
      rol_dependencias: { [mpCalcId]: "precio_caliza_martillo" },
    });

    // ─── Capa de agregación: movimiento de MP (100% caliza con precio evaluado) ──
    const produccion = produccionNormalizada(ctx, proceso.id, periodo);
    await writeMovimientosMp(
      { ctx, proceso, periodo, writer },
      produccion,
      [{ codigo: mat.codigo, nombre: mat.nombre, pct: 1.0, precio: precioMP }],
    );

    // ─── Energía eléctrica + Costos fijos ───────────────────────────────
    // Fase 3: clasificar (repuestos vs servicios/regalías) + placeholders.
    const aux = await logComponentesAuxiliares(
      { ctx, proceso, periodo, writer },
      { conEnergia: true, energiaKey: "adiciones", conCostosFijos: true, clasificar: true, registrarPlaceholders: true,
        movimientos: { produccion } },
    );
    const costo_energia   = aux.costo_energia;
    const energiaCalcId   = aux.energiaCalcId;
    const fijosTotal      = aux.costo_servicios;          // suma de todos los fijos
    const costo_repuestos = aux.costo_repuestos;
    const restoServicios  = (fijosTotal ?? 0) - (costo_repuestos ?? 0);
    const costo_servicios = restoServicios > 0 ? restoServicios : null;
    const fijosCalcIds    = aux.fijosCalcIds;
    const fijosRolDeps    = aux.fijosRolDeps;

    // ─── Total ────────────────────────────────────────────────────────
    const costo_total = f.valor + (costo_energia ?? 0) + (fijosTotal ?? 0);
    const dependeDe: UUID[] = [mpId, mpCalcId];
    const rolDepsTotal: Record<string, string> = { [mpId]: "costo_mp", [mpCalcId]: "precio_caliza_martillo" };
    if (energiaCalcId) { dependeDe.push(energiaCalcId); rolDepsTotal[energiaCalcId] = "costo_energia"; }
    for (const fid of fijosCalcIds) { dependeDe.push(fid); rolDepsTotal[fid] = fijosRolDeps[fid]; }

    const totalId = await writer.log({
      calculo_tipo: "costo_proceso_total",
      proceso_id: proceso.id,
      periodo,
      concepto: `Costo total proceso — ${proceso.nombre}`,
      valor_resultado: costo_total,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_PROCESO_SUMA_v1",
      formula_expresion:
        `costo_mp=${f.valor}` +
        (costo_energia != null ? ` + energia=${costo_energia}` : "") +
        (fijosTotal    != null ? ` + fijos=${fijosTotal}`      : "") +
        ` → total=${costo_total}`,
      parametros_entrada: { costo_mp: f.valor, costo_energia, costo_fijos: fijosTotal, costo_repuestos, costo_servicios },
      nivel_jerarquia: 0,
      depende_de: dependeDe,
      rol_dependencias: rolDepsTotal,
    });

    return {
      proceso_id: proceso.id,
      periodo,
      costo_materia_prima: f.valor,
      costo_combustible:   null,
      costo_energia,
      costo_repuestos,
      costo_servicios,
      costo_total,
      costo_por_ton: costo_total,
      costo_recibido_arrastre:  0,
      costo_total_arrastrado:   costo_total,
      costo_por_ton_arrastrado: costo_total,
      calc_total_id: totalId,
    };
  }
}
