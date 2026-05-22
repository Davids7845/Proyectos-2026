// ORD 4 — Molienda de Carbón (producto: CARBÓN MOLIDO)
//
// Cadena de cálculo (idéntica en estructura a ORD 3 pero sin materiales derivados;
// los carbones son compras directas):
//   1) precio_componente_directo × N   (uno por cada carbón en la receta)
//   2) costo_mp_carbon                 COSTO_MP_RECETA_v1
//   3) costo_proceso_total             COSTO_PROCESO_SUMA_v1

import { fn as calcMpReceta } from "@/lib/calc/formulas/costo_mp_receta";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
  UUID,
} from "@/lib/calc/engine/context";

export class Ord04MoliendaCarbon implements ProcesoCalculator {
  ord = 4;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    const { ctx, proceso, periodo, writer } = args;

    // ─── Receta ──────────────────────────────────────────────────
    const receta = ctx.recetasByProcesoPeriodo.get(`${proceso.id}|${periodo}`);
    if (!receta) throw new Error(`ORD4 ${periodo}: no hay receta para Carbón Molido`);
    if (receta.lineas.length === 0) throw new Error(`ORD4 ${periodo}: receta vacía`);

    // ─── 1) Precio de cada carbón (todos directos) ───────────────
    interface Componente {
      material_codigo: string;
      material_nombre: string;
      pct: number;
      precio: number;
      precio_calc_id: UUID;
    }
    const componentes: Componente[] = [];

    for (const ln of receta.lineas) {
      const mat = ctx.materialesById.get(ln.material_id);
      if (!mat) throw new Error(`ORD4 ${periodo}: material ${ln.material_id} no encontrado`);

      const ki = `${mat.id}|${periodo}|`;
      const p = ctx.preciosByMatPeriodo.get(ki);
      if (!p) throw new Error(`ORD4 ${periodo}: falta precio para ${mat.codigo}`);

      const precioCalcId = await writer.log({
        calculo_tipo: "precio_componente_directo",
        proceso_id: proceso.id,
        material_id: mat.id,
        periodo,
        concepto: `Precio ${mat.nombre}`,
        valor_resultado: p.precio,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `precio = ${p.precio} (precios_insumos)`,
        parametros_entrada: { precio_directo: p.precio },
        nivel_jerarquia: 2,
      });

      componentes.push({
        material_codigo: mat.codigo,
        material_nombre: mat.nombre,
        pct: ln.porcentaje,
        precio: p.precio,
        precio_calc_id: precioCalcId,
      });
    }

    // ─── 2) Calcular MP con COSTO_MP_RECETA_v1 ──────────────────
    const items = componentes.map(c => ({ codigo: c.material_codigo, nombre: c.material_nombre, pct: c.pct }));
    const mpParams: Record<string, number | string> = { items_json: JSON.stringify(items) };
    for (const c of componentes) mpParams[`precio_${c.material_codigo}`] = c.precio;

    const mpResult = calcMpReceta(mpParams);

    const rolDeps: Record<string, string> = {};
    for (const c of componentes) rolDeps[c.precio_calc_id] = `precio_${c.material_codigo}`;

    const mpId = await writer.log({
      calculo_tipo: "costo_mp_carbon",
      proceso_id: proceso.id,
      periodo,
      concepto: "Costo Materia Prima — Carbón Molido",
      valor_resultado: mpResult.valor,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_MP_RECETA_v1",
      formula_expresion: mpResult.expresion_evaluada,
      parametros_entrada: mpParams,
      nivel_jerarquia: 1,
      depende_de: componentes.map(c => c.precio_calc_id),
      rol_dependencias: rolDeps,
    });

    // ─── 3) Total proceso ────────────────────────────────────────
    const costo_total = mpResult.valor;
    const totalId = await writer.log({
      calculo_tipo: "costo_proceso_total",
      proceso_id: proceso.id,
      periodo,
      concepto: `Costo total proceso — ${proceso.nombre}`,
      valor_resultado: costo_total,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_PROCESO_SUMA_v1",
      formula_expresion: `costo_mp=${mpResult.valor} → total=${costo_total}`,
      parametros_entrada: { costo_mp: mpResult.valor },
      nivel_jerarquia: 0,
      depende_de: [mpId],
      rol_dependencias: { [mpId]: "costo_mp" },
    });

    return {
      proceso_id: proceso.id,
      periodo,
      costo_materia_prima: mpResult.valor,
      costo_combustible:   null,
      costo_energia:       null,
      costo_repuestos:     null,
      costo_servicios:     null,
      costo_total,
      costo_por_ton: costo_total,
      costo_recibido_arrastre:  0,
      costo_total_arrastrado:   costo_total,
      costo_por_ton_arrastrado: costo_total,
      calc_total_id: totalId,
    };
  }
}
