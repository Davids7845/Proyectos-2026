// ORD 2 — Adiciones (producto: CALIZA PARA ADICIONES)
//
// Versión 1: el costo es el precio directo de "Caliza Triturada" (CALIZATRI) más
// eventuales servicios asociados. Cuando tengamos visibilidad completa del Excel
// agregaremos energía + repuestos.

import { fn as calcMezcla } from "@/lib/calc/formulas/costo_mezcla_ponderada";
import type {
  CalcWriter,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
  Periodo,
  CalcContext,
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

    const costo_total = f.valor;
    const totalId = await writer.log({
      calculo_tipo: "costo_proceso_total",
      proceso_id: proceso.id,
      periodo,
      concepto: `Costo total proceso — ${proceso.nombre}`,
      valor_resultado: costo_total,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_MEZCLA_PONDERADA_v1",
      formula_expresion: `costo_total = costo_mp_adiciones = ${costo_total}`,
      parametros_entrada: { costo_mp_adiciones: f.valor },
      nivel_jerarquia: 0,
      depende_de: [mpId],
      rol_dependencias: { [mpId]: "costo_mp" },
    });

    return {
      proceso_id: proceso.id,
      periodo,
      costo_materia_prima: f.valor,
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
