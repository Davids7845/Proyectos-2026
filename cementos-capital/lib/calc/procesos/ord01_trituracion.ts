// ORD 1 — Trituración (producto: MEZCLA PREHOMO)
//
// Cadena de cálculo (un periodo):
//   1) precio_caliza_martillo   = COSTO_CALIZA_MARTILLO_v1(precio_caliza, costo_martillo, pct_caliza, pct_martillo)
//   2) costo_mp_prehomo         = COSTO_PREHOMO_v1(precio_caliza_martillo, precio_arcilla, pct_caliza_prehomo, pct_arcilla_prehomo)
//   3) costo_total              = costo_mp_prehomo + (otros componentes si existen, omitidos en v1)
//   4) costo_por_ton            = costo_total / 1 ton (la MP ya viene en COP/Ton)
//
// Materiales claves (por código en `materiales`):
//   - CALTLVTRIT  = Caliza en Prehomo (Explotada)
//   - ARCTLVTRIT  = Arcilla en Prehomo (Explotada)
//   - "Costo Adicional Martillo" → no es material, es un costo asociado a CALTLVTRIT (proveedor='martillo')
//
// El % Consumo de caliza/martillo se busca por material CALTLVTRIT con proveedor 'caliza' y 'martillo'.
// La receta Prehomo está en `recetas` para proceso_id=ord1 y producto_id=MEZCPREHO (Mezcla Prehomo).

import { fn as calcCalizaMartillo } from "@/lib/calc/formulas/costo_caliza_martillo";
import { fn as calcPrehomo } from "@/lib/calc/formulas/costo_prehomo";
import type {
  CalcContext,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
  CalcWriter,
  Periodo,
  UUID,
} from "@/lib/calc/engine/context";

const CODIGO_CALIZA   = "CALTLVTRIT";
const CODIGO_ARCILLA  = "ARCTLVTRIT";
const CODIGO_MARTILLO_PROVEEDOR = "martillo"; // proveedor en precios_insumos

function precioKey(material_id: string, periodo: Periodo, proveedor: string | null = null): string {
  return `${material_id}|${periodo}|${proveedor ?? ""}`;
}
function pctKey(material_id: string, periodo: Periodo, proveedor: string): string {
  return `${material_id}|${periodo}|${proveedor}`;
}

export class Ord01Trituracion implements ProcesoCalculator {
  ord = 1;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    const { ctx, proceso, periodo, writer } = args;

    const matCaliza  = ctx.materialesByCodigo.get(CODIGO_CALIZA);
    const matArcilla = ctx.materialesByCodigo.get(CODIGO_ARCILLA);
    if (!matCaliza || !matArcilla) {
      throw new Error(`ORD1: faltan materiales ${CODIGO_CALIZA} y/o ${CODIGO_ARCILLA}`);
    }

    // ─── 1) Insumos directos ────────────────────────────────────────
    const precioCaliza   = ctx.preciosByMatPeriodo.get(precioKey(matCaliza.id, periodo));
    const precioMartillo = ctx.preciosByMatPeriodo.get(precioKey(matCaliza.id, periodo, CODIGO_MARTILLO_PROVEEDOR));
    const precioArcilla  = ctx.preciosByMatPeriodo.get(precioKey(matArcilla.id, periodo));
    if (!precioCaliza || !precioMartillo || !precioArcilla) {
      throw new Error(
        `ORD1 ${periodo}: faltan precios (caliza=${!!precioCaliza}, martillo=${!!precioMartillo}, arcilla=${!!precioArcilla})`
      );
    }

    const pctCaliza   = ctx.pctConsumoByKey.get(pctKey(matCaliza.id, periodo, "caliza"));
    const pctMartillo = ctx.pctConsumoByKey.get(pctKey(matCaliza.id, periodo, "martillo"));
    if (!pctCaliza || !pctMartillo) {
      throw new Error(`ORD1 ${periodo}: faltan % consumo caliza/martillo`);
    }

    // % de receta Prehomo: en `recetas` para este proceso
    const receta = ctx.recetasByProcesoPeriodo.get(`${proceso.id}|${periodo}`);
    if (!receta) {
      throw new Error(`ORD1 ${periodo}: no hay receta para Prehomo`);
    }
    const lnCaliza  = receta.lineas.find(l => l.material_id === matCaliza.id);
    const lnArcilla = receta.lineas.find(l => l.material_id === matArcilla.id);
    if (!lnCaliza || !lnArcilla) {
      throw new Error(`ORD1 ${periodo}: receta Prehomo no tiene caliza+arcilla`);
    }

    // ─── 2) Fórmula 1: Precio Caliza+Martillo ponderado ────────────
    const f1 = calcCalizaMartillo({
      precio_caliza:  precioCaliza.precio,
      costo_martillo: precioMartillo.precio,
      pct_caliza:     pctCaliza.porcentaje,
      pct_martillo:   pctMartillo.porcentaje,
    });
    const f1Id = await writer.log({
      calculo_tipo: "precio_caliza_martillo",
      proceso_id: proceso.id,
      material_id: matCaliza.id,
      periodo,
      concepto: "Precio Caliza + Martillo ponderado",
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

    // ─── 3) Fórmula 2: Costo MP Prehomo (caliza+martillo + arcilla ponderados) ────────
    const f2 = calcPrehomo({
      precio_caliza_martillo: f1.valor,
      precio_arcilla:         precioArcilla.precio,
      pct_caliza:             lnCaliza.porcentaje,
      pct_arcilla:            lnArcilla.porcentaje,
    });
    const f2Id = await writer.log({
      calculo_tipo: "costo_mp_prehomo",
      proceso_id: proceso.id,
      periodo,
      concepto: "Costo Materia Prima — Prehomo",
      valor_resultado: f2.valor,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_PREHOMO_v1",
      formula_expresion: f2.expresion_evaluada,
      parametros_entrada: {
        precio_caliza_martillo: f1.valor,
        precio_arcilla: precioArcilla.precio,
        pct_caliza: lnCaliza.porcentaje,
        pct_arcilla: lnArcilla.porcentaje,
      },
      nivel_jerarquia: 1,
      depende_de: [f1Id],
      rol_dependencias: { [f1Id]: "precio_caliza_martillo" },
    });

    // ─── 4) Costos fijos (Fase 1.6.2): Barras y Placas, Material Dique, Regalías, etc.
    let costo_servicios: number | null = null;
    const fijosCalcIds: UUID[] = [];
    const fijosRolDeps: Record<string, string> = {};
    const items = ctx.costosFijosByProcesoPeriodo?.get(`${proceso.id}|${periodo}`) ?? [];
    if (items.length > 0) {
      let suma = 0;
      for (const it of items) {
        if (it.costo_por_ton === 0) continue;
        suma += it.costo_por_ton;
        const id = await writer.log({
          calculo_tipo: "costo_fijo_proceso",
          proceso_id: proceso.id,
          periodo,
          concepto: `${it.nombre} (costo fijo)`,
          valor_resultado: it.costo_por_ton,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `${it.codigo}: ${it.costo_por_ton} COP/Ton (Excel)`,
          parametros_entrada: { codigo: it.codigo, costo_por_ton: it.costo_por_ton },
          nivel_jerarquia: 1,
        });
        fijosCalcIds.push(id);
        fijosRolDeps[id] = `fijo_${it.codigo.toLowerCase()}`;
      }
      if (suma > 0) costo_servicios = suma;
    }

    // ─── 5) Costo total proceso ────────────────────────────────────────
    const costo_total = f2.valor + (costo_servicios ?? 0);
    const costo_por_ton = costo_total;

    const dependeDeTotal: UUID[] = [f2Id, ...fijosCalcIds];
    const rolDepsTotal: Record<string, string> = { [f2Id]: "costo_mp", ...fijosRolDeps };

    const totalId = await writer.log({
      calculo_tipo: "costo_proceso_total",
      proceso_id: proceso.id,
      periodo,
      concepto: `Costo total proceso — ${proceso.nombre}`,
      valor_resultado: costo_total,
      unidad: "COP/Ton",
      formula_codigo: "COSTO_PROCESO_SUMA_v1",
      formula_expresion:
        `costo_mp=${f2.valor}` +
        (costo_servicios != null ? ` + costo_servicios=${costo_servicios}` : "") +
        ` → total=${costo_total}`,
      parametros_entrada: { costo_mp: f2.valor, costo_servicios },
      nivel_jerarquia: 0,
      depende_de: dependeDeTotal,
      rol_dependencias: rolDepsTotal,
    });

    return {
      proceso_id: proceso.id,
      periodo,
      costo_materia_prima: f2.valor,
      costo_combustible:   null,
      costo_energia:       null,
      costo_repuestos:     null,
      costo_servicios,
      costo_total,
      costo_por_ton,
      costo_recibido_arrastre:  0,
      costo_total_arrastrado:   costo_total,
      costo_por_ton_arrastrado: costo_por_ton,
      calc_total_id: totalId,
    };
  }
}
