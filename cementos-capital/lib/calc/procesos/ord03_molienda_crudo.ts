// ORD 3 — Molienda de Crudo (producto: HARINA CRUDA)
//
// Cadena de cálculo:
//   1) precio_MEZCPREHO        wrapper que envuelve el costo arrastrado de ORD 1 (Trituración).
//                              Mantiene la trazabilidad: dep → calc_total_id de ORD 1.
//   2) costo_mp_crudo          COSTO_MP_RECETA_v1 con items={Prehomo, Hierro, Calamina}
//                              y precio_<codigo> por cada uno.
//   3) costo_proceso_total     SUMA del MP (energía/repuestos/servicios se sumarán en futuras iteraciones).

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

// Materiales producidos por procesos anteriores (mapa material_codigo → ord productor)
// Cuando agreguemos más procesos extendemos este mapa.
const DERIVED_BY_CODIGO: Record<string, number> = {
  MEZCPREHO: 1,
};

export class Ord03MoliendaCrudo implements ProcesoCalculator {
  ord = 3;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    const { ctx, proceso, periodo, writer } = args;

    // ─── Receta ─────────────────────────────────────────────────
    const receta = ctx.recetasByProcesoPeriodo.get(`${proceso.id}|${periodo}`);
    if (!receta) throw new Error(`ORD3 ${periodo}: no hay receta para Harina Cruda`);
    if (receta.lineas.length === 0) throw new Error(`ORD3 ${periodo}: receta vacía`);

    // ─── 1) Resolver precio de cada componente ──────────────────
    interface Componente {
      material_codigo: string;
      material_nombre: string;
      pct: number;
      precio: number;
      precio_calc_id: UUID;        // log entry que representa el precio (wrapper)
    }
    const componentes: Componente[] = [];

    for (const ln of receta.lineas) {
      const mat = ctx.materialesById.get(ln.material_id);
      if (!mat) throw new Error(`ORD3 ${periodo}: material ${ln.material_id} no encontrado`);

      let precio: number;
      let precioCalcId: UUID;
      const productorOrd = DERIVED_BY_CODIGO[mat.codigo];
      if (productorOrd != null) {
        // Componente derivado: precio = costo arrastrado del proceso productor
        const productor = ctx.procesos.find(p => p.ord === productorOrd);
        if (!productor) throw new Error(`ORD3 ${periodo}: no se encontró proceso ORD ${productorOrd}`);
        const arrastrado = ctx.costoProcesoByKey.get(`${productor.id}|${periodo}`);
        if (!arrastrado) throw new Error(`ORD3 ${periodo}: ORD ${productorOrd} aún no calculado`);
        precio = arrastrado.costo_por_ton;

        // Wrapper log entry para trazabilidad y override propagable
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
        // Componente leaf: precio = precios_insumos
        const ki = `${mat.id}|${periodo}|`;
        const p = ctx.preciosByMatPeriodo.get(ki);
        if (!p) throw new Error(`ORD3 ${periodo}: falta precio para ${mat.codigo}`);
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
    const mpParams: Record<string, number | string> = {
      items_json: JSON.stringify(items),
    };
    for (const c of componentes) mpParams[`precio_${c.material_codigo}`] = c.precio;

    const mpResult = calcMpReceta(mpParams);

    const rolDeps: Record<string, string> = {};
    for (const c of componentes) rolDeps[c.precio_calc_id] = `precio_${c.material_codigo}`;

    const mpId = await writer.log({
      calculo_tipo: "costo_mp_crudo",
      proceso_id: proceso.id,
      periodo,
      concepto: "Costo Materia Prima — Harina Cruda",
      valor_resultado: mpResult.valor,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_MP_RECETA_v1",
      formula_expresion: mpResult.expresion_evaluada,
      parametros_entrada: mpParams,
      nivel_jerarquia: 1,
      depende_de: componentes.map(c => c.precio_calc_id),
      rol_dependencias: rolDeps,
    });

    // ─── 3) Total proceso ───────────────────────────────────────
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
