// ORD 2 — Adiciones (producto: CALIZA PARA ADICIONES)
//
// Componentes: MP (Caliza Triturada) + Energía + Barras y Placas +
//              Material Dique + Desmantelamiento + Regalías.

import { fn as calcMezcla }          from "@/lib/calc/formulas/costo_mezcla_ponderada";
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

const CODIGOS_CALIZA_PRIORIDAD = ["CALIZATRI", "CALTLVTRIT"];

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

    // Busca el primer código de caliza con precio disponible. Esto cubre los
    // dos escenarios del Excel: la "Caliza Triturada" estándar (CALIZATRI) y
    // el alias "Caliza Explotada" que se importa como CALTLVTRIT cuando el
    // Excel sólo trae el nombre canónico.
    let mat: { id: string; nombre: string; codigo: string } | undefined;
    let precio: { precio: number } | undefined;
    for (const codigo of CODIGOS_CALIZA_PRIORIDAD) {
      const m = ctx.materialesByCodigo.get(codigo);
      if (!m) continue;
      const p = ctx.preciosByMatPeriodo.get(`${m.id}|${periodo}|`);
      if (p) { mat = m; precio = p; break; }
    }
    if (!mat || !precio) {
      throw new Error(`ORD2 ${periodo}: falta precio de caliza (probó ${CODIGOS_CALIZA_PRIORIDAD.join(", ")})`);
    }

    // En esta v1 sólo hay un componente (100% caliza para adiciones).
    // Aún así usamos la fórmula ponderada para mantener trazabilidad uniforme.
    const items = [{ nombre: mat.nombre, precio: precio.precio, pct: 1.0 }];
    const f = calcMezcla({ items_json: JSON.stringify(items) });

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
      parametros_entrada: { items },
      nivel_jerarquia: 1,
    });

    // ─── Capa de agregación: movimiento de MP (100% caliza) ─────────────
    const produccion = produccionNormalizada(ctx, proceso.id, periodo);
    await writeMovimientosMp(
      { ctx, proceso, periodo, writer },
      produccion,
      [{ codigo: mat.codigo, nombre: mat.nombre, pct: 1.0, precio: precio.precio }],
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
    const dependeDe: UUID[] = [mpId];
    const rolDepsTotal: Record<string, string> = { [mpId]: "costo_mp" };
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
