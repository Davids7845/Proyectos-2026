// ORD 5 — Clinkerización (producto: CLINKER)
//
// Cadena de cálculo:
//   1) precio_HARINACRUD  wrapper derivado → costo arrastrado de ORD 3
//   2) precio_CARBONMOL   wrapper derivado → costo arrastrado de ORD 4
//   3) precio_<X>         precio directo por cada componente no derivado en receta
//   4) costo_mp_clinker   COSTO_MP_RECETA_v1
//   5) costo_proceso_total COSTO_PROCESO_SUMA_v1

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

// Materiales semielaborados que llegan de procesos anteriores
const DERIVED_BY_CODIGO: Record<string, number> = {
  HARINACRUD: 3,
  CARBONMOL:  4,
};

export class Ord05Clinkerizacion implements ProcesoCalculator {
  ord = 5;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    const { ctx, proceso, periodo, writer } = args;

    // ─── Receta ──────────────────────────────────────────────────
    const receta = ctx.recetasByProcesoPeriodo.get(`${proceso.id}|${periodo}`);
    if (!receta) throw new Error(`ORD5 ${periodo}: no hay receta para Clinker`);
    if (receta.lineas.length === 0) throw new Error(`ORD5 ${periodo}: receta vacía`);

    // ─── 1) Resolver precio de cada componente ───────────────────
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
      if (!mat) throw new Error(`ORD5 ${periodo}: material ${ln.material_id} no encontrado`);

      let precio: number;
      let precioCalcId: UUID;
      const productorOrd = DERIVED_BY_CODIGO[mat.codigo];

      if (productorOrd != null) {
        // Componente derivado: precio = costo arrastrado del proceso productor
        const productor = ctx.procesos.find(p => p.ord === productorOrd);
        if (!productor) throw new Error(`ORD5 ${periodo}: no se encontró proceso ORD ${productorOrd}`);
        const arrastrado = ctx.costoProcesoByKey.get(`${productor.id}|${periodo}`);
        if (!arrastrado) throw new Error(`ORD5 ${periodo}: ORD ${productorOrd} aún no calculado`);
        precio = arrastrado.costo_por_ton;

        precioCalcId = await writer.log({
          calculo_tipo: "precio_componente_derivado",
          proceso_id: proceso.id,
          material_id: mat.id,
          periodo,
          concepto: `Precio ${mat.nombre} (arrastrado de ORD ${productorOrd})`,
          valor_resultado: precio,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `precio = costo_por_ton de ORD ${productorOrd} = ${precio}`,
          parametros_entrada: { costo_arrastrado: precio },
          nivel_jerarquia: 2,
          depende_de: [arrastrado.calc_total_id],
          rol_dependencias: { [arrastrado.calc_total_id]: "costo_arrastrado" },
        });
      } else {
        // Componente directo: precio = precios_insumos
        const ki = `${mat.id}|${periodo}|`;
        const p = ctx.preciosByMatPeriodo.get(ki);
        if (!p) throw new Error(`ORD5 ${periodo}: falta precio para ${mat.codigo}`);
        precio = p.precio;

        precioCalcId = await writer.log({
          calculo_tipo: "precio_componente_directo",
          proceso_id: proceso.id,
          material_id: mat.id,
          periodo,
          concepto: `Precio ${mat.nombre}`,
          valor_resultado: precio,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `precio = ${precio} (precios_insumos)`,
          parametros_entrada: { precio_directo: precio },
          nivel_jerarquia: 2,
        });
      }

      componentes.push({
        material_codigo: mat.codigo,
        material_nombre: mat.nombre,
        pct: ln.porcentaje,
        precio,
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
      calculo_tipo: "costo_mp_clinker",
      proceso_id: proceso.id,
      periodo,
      concepto: "Costo Materia Prima — Clinker",
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
