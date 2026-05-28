// ORD 2 — Adiciones (producto: CALIZA PARA ADICIONES)
//
// Componentes: MP (Caliza Triturada) + Energía + Barras y Placas +
//              Material Dique + Desmantelamiento + Regalías.

import { fn as calcMezcla }           from "@/lib/calc/formulas/costo_mezcla_ponderada";
import { fn as calcEnergiaProceso }   from "@/lib/calc/formulas/costo_energia_proceso";
import type {
  CalcWriter,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
  Periodo,
  CalcContext,
  UUID,
} from "@/lib/calc/engine/context";

const CODIGO_CALIZA_TRITURADA = "CALIZATRI";

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

    const mat = ctx.materialesByCodigo.get(CODIGO_CALIZA_TRITURADA);
    if (!mat) throw new Error(`ORD2: falta material ${CODIGO_CALIZA_TRITURADA}`);

    const precio = ctx.preciosByMatPeriodo.get(`${mat.id}|${periodo}|`);
    if (!precio) throw new Error(`ORD2 ${periodo}: falta precio Caliza Triturada`);

    // En esta v1 sólo hay un componente (100% caliza triturada).
    // Aún así usamos la fórmula ponderada para mantener trazabilidad uniforme.
    const items = [{ nombre: "Caliza Triturada", precio: precio.precio, pct: 1.0 }];
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

    // ─── Energía eléctrica ─────────────────────────────────────────────
    let costo_energia: number | null = null;
    let energiaCalcId: UUID | null = null;
    const enOver = ctx.energiaOverrideByKey?.get(`${proceso.id}|${periodo}`);
    if (enOver && enOver.kwh_ton > 0) {
      const valor = enOver.kwh_ton * enOver.precio_efectivo;
      costo_energia = valor;
      energiaCalcId = await writer.log({
        calculo_tipo: "costo_energia_proceso",
        proceso_id: proceso.id,
        periodo,
        concepto: `Costo Energía Eléctrica — ${proceso.nombre}`,
        valor_resultado: valor,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_ENERGIA_PROCESO_v1",
        formula_expresion: `kwh_ton(${enOver.kwh_ton}) × precio_efectivo(${enOver.precio_efectivo}) = ${valor}`,
        parametros_entrada: { kwh_ton: enOver.kwh_ton, precio_efectivo: enOver.precio_efectivo },
        nivel_jerarquia: 1,
      });
    } else {
      const paramsEner = ctx.parametrosEnergiaByPeriodo?.get(periodo);
      if (paramsEner) {
        const kwhMap = paramsEner.kwh_ton_proceso ?? {};
        const kwh = kwhMap["adiciones"] ?? 0;
        if (kwh > 0) {
          const f2 = calcEnergiaProceso({
            kwh_ton: kwh,
            precio_contrato:      paramsEner.precio_contrato      ?? 0,
            precio_restricciones: paramsEner.precio_restricciones ?? 0,
            cargos_fijos:         paramsEner.cargos_fijos         ?? 0,
          });
          costo_energia = f2.valor;
          energiaCalcId = await writer.log({
            calculo_tipo: "costo_energia_proceso",
            proceso_id: proceso.id,
            periodo,
            concepto: `Costo Energía Eléctrica — ${proceso.nombre}`,
            valor_resultado: f2.valor,
            unidad: "COP/Ton",
            formula_codigo: "COSTO_ENERGIA_PROCESO_v1",
            formula_expresion: f2.expresion_evaluada,
            parametros_entrada: { kwh_ton: kwh, precio_contrato: paramsEner.precio_contrato, precio_restricciones: paramsEner.precio_restricciones, cargos_fijos: paramsEner.cargos_fijos },
            nivel_jerarquia: 1,
          });
        }
      }
    }

    // ─── Costos fijos: Barras y Placas, Material Dique, Desmantelamiento, Regalías ─
    let costo_servicios: number | null = null;
    const fijosCalcIds: UUID[] = [];
    const fijosRolDeps: Record<string, string> = {};
    const fijoItems = ctx.costosFijosByProcesoPeriodo?.get(`${proceso.id}|${periodo}`) ?? [];
    for (const it of fijoItems) {
      if (it.costo_por_ton === 0) continue;
      const id = await writer.log({
        calculo_tipo: "costo_fijo_proceso",
        proceso_id: proceso.id,
        periodo,
        concepto: it.nombre,
        valor_resultado: it.costo_por_ton,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `${it.codigo}: ${it.costo_por_ton} COP/Ton (Excel)`,
        parametros_entrada: { codigo: it.codigo, costo_por_ton: it.costo_por_ton },
        nivel_jerarquia: 1,
      });
      fijosCalcIds.push(id);
      fijosRolDeps[id] = `fijo_${it.codigo.toLowerCase()}`;
      costo_servicios = (costo_servicios ?? 0) + it.costo_por_ton;
    }

    // ─── Total ────────────────────────────────────────────────────────
    const costo_total = f.valor + (costo_energia ?? 0) + (costo_servicios ?? 0);
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
        (costo_energia   != null ? ` + energia=${costo_energia}`   : "") +
        (costo_servicios != null ? ` + servicios=${costo_servicios}` : "") +
        ` → total=${costo_total}`,
      parametros_entrada: { costo_mp: f.valor, costo_energia, costo_servicios },
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
      costo_repuestos:     null,
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
