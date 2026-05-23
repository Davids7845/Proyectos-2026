// ORD 21 — Cementos (proceso consolidador / portfolio)
//
// Agrega los costos de todos los procesos de cemento calculados en el mismo
// periodo. Produce un costo promedio de portfolio como indicador resumen.
//
// Patrón diferente a _receta_base: no usa receta de materiales sino que
// itera costoProcesoByKey buscando los ORDs de la familia CEMENTOS.
//
// PENDIENTE: cuando esté disponible el Excel con volúmenes de producción,
// reemplazar el promedio simple por media ponderada (ton × costo).

import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult, UUID,
} from "@/lib/calc/engine/context";

// ORDs cuyo costo se consolida en este proceso
const CEMENT_ORDS = [6, 7, 8, 9, 10, 11, 14, 15, 16, 19];

export class Ord21Cementos implements ProcesoCalculator {
  ord = 21;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    const { ctx, proceso, periodo, writer } = args;

    // Recopilar costos calculados de los ORDs de cemento
    interface Referencia {
      ord: number;
      nombre: string;
      costo_por_ton: number;
      calc_total_id: UUID;
    }
    const referencias: Referencia[] = [];

    for (const ord of CEMENT_ORDS) {
      const proc = ctx.procesos.find(p => p.ord === ord);
      if (!proc) continue; // proceso no configurado en esta versión, se omite
      const entry = ctx.costoProcesoByKey.get(`${proc.id}|${periodo}`);
      if (!entry) continue; // no calculado aún — se omite en lugar de fallar
      referencias.push({
        ord,
        nombre: proc.nombre,
        costo_por_ton: entry.costo_por_ton,
        calc_total_id: entry.calc_total_id,
      });
    }

    if (referencias.length === 0) {
      throw new Error(`ORD21 ${periodo}: ningún proceso de cemento calculado previo`);
    }

    // ─── Log entry por cada proceso fuente ─────────────────────────────────
    const refCalcIds: UUID[] = [];
    const rolDeps: Record<UUID, string> = {};
    const mpParams: Record<string, number | string> = {};

    for (const ref of referencias) {
      const refId = await writer.log({
        calculo_tipo: "costo_referencia_cemento",
        proceso_id: proceso.id,
        periodo,
        concepto: `Costo ORD ${ref.ord} — ${ref.nombre}`,
        valor_resultado: ref.costo_por_ton,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `costo_por_ton ORD ${ref.ord} = ${ref.costo_por_ton}`,
        parametros_entrada: { costo_arrastrado: ref.costo_por_ton },
        nivel_jerarquia: 1,
        depende_de: [ref.calc_total_id],
        rol_dependencias: { [ref.calc_total_id]: "costo_arrastrado" },
      });
      refCalcIds.push(refId);
      rolDeps[refId] = `costo_ord_${ref.ord}`;
      mpParams[`costo_ord_${ref.ord}`] = ref.costo_por_ton;
    }

    // ─── Promedio simple (placeholder hasta tener volúmenes) ──────────────
    const promedio = referencias.reduce((s, r) => s + r.costo_por_ton, 0) / referencias.length;

    const totalId = await writer.log({
      calculo_tipo: "costo_proceso_total",
      proceso_id: proceso.id,
      periodo,
      concepto: `Costo total proceso — ${proceso.nombre} (promedio portfolio)`,
      valor_resultado: promedio,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_PROCESO_SUMA_v1",
      formula_expresion: `promedio(${referencias.map(r => r.ord).join(",")}) = ${promedio.toFixed(2)}`,
      parametros_entrada: mpParams,
      nivel_jerarquia: 0,
      depende_de: refCalcIds,
      rol_dependencias: rolDeps,
    });

    return {
      proceso_id: proceso.id,
      periodo,
      costo_materia_prima: promedio,
      costo_combustible:   null,
      costo_energia:       null,
      costo_repuestos:     null,
      costo_servicios:     null,
      costo_total: promedio,
      costo_por_ton: promedio,
      costo_recibido_arrastre:  0,
      costo_total_arrastrado:   promedio,
      costo_por_ton_arrastrado: promedio,
      calc_total_id: totalId,
    };
  }
}
