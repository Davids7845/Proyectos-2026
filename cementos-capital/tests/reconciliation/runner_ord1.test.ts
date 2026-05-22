// Test end-to-end del runner para ORD 1 (Trituración) usando InMemoryWriter.
// No requiere Supabase. Valida la cadena completa:
//   precio_caliza_martillo → costo_mp_prehomo → costo_total
// contra los benchmarks reales del Excel (Sep-2025 y Ene-2026).

import { describe, it, expect, beforeAll } from "vitest";
import { Ord01Trituracion } from "@/lib/calc/procesos/ord01_trituracion";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const VERSION_ID = "v-test";
const RUN_ID = "r-test";

// IDs ficticios pero deterministas
const PROC_ORD1_ID = "proc-ord1";
const MAT_CALIZA_ID = "mat-caltlvtrit";
const MAT_ARCILLA_ID = "mat-arctlvtrit";
const MAT_PRODUCTO_ID = "mat-mezcpreho";

function buildContext(periodo: string, params: {
  precio_caliza: number;
  precio_martillo: number;
  precio_arcilla: number;
  pct_caliza: number;     // % consumo caliza (vs martillo)
  pct_martillo: number;
  pct_caliza_prehomo: number;  // receta Prehomo
  pct_arcilla_prehomo: number;
}): CalcContext {
  const proceso: ProcesoMeta = {
    id: PROC_ORD1_ID,
    ord: 1,
    material: "MEZCLA PREHOMO",
    nombre: "Trituración",
    orden_topologico: 1,
  };

  const materialesById = new Map([
    [MAT_CALIZA_ID,   { id: MAT_CALIZA_ID,   codigo: "CALTLVTRIT", nombre: "Caliza en Prehomo", unidad_base: "T" }],
    [MAT_ARCILLA_ID,  { id: MAT_ARCILLA_ID,  codigo: "ARCTLVTRIT", nombre: "Arcilla en Prehomo", unidad_base: "T" }],
    [MAT_PRODUCTO_ID, { id: MAT_PRODUCTO_ID, codigo: "MEZCPREHO",  nombre: "Mezcla Prehomo",     unidad_base: "T" }],
  ]);
  const materialesByCodigo = new Map(Array.from(materialesById.values()).map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_CALIZA_ID}|${periodo}|`,         { material_id: MAT_CALIZA_ID,  proveedor: null,       periodo, precio: params.precio_caliza,   unidad: "COP/Ton" }],
    [`${MAT_CALIZA_ID}|${periodo}|martillo`, { material_id: MAT_CALIZA_ID,  proveedor: "martillo", periodo, precio: params.precio_martillo, unidad: "COP/Ton" }],
    [`${MAT_ARCILLA_ID}|${periodo}|`,        { material_id: MAT_ARCILLA_ID, proveedor: null,       periodo, precio: params.precio_arcilla,  unidad: "COP/Ton" }],
  ]);

  const pctConsumoByKey = new Map([
    [`${MAT_CALIZA_ID}|${periodo}|caliza`,   { material_id: MAT_CALIZA_ID, proveedor: "caliza",   periodo, porcentaje: params.pct_caliza }],
    [`${MAT_CALIZA_ID}|${periodo}|martillo`, { material_id: MAT_CALIZA_ID, proveedor: "martillo", periodo, porcentaje: params.pct_martillo }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    [`${PROC_ORD1_ID}|${periodo}`, {
      receta_id: "rec-1",
      producto_id: MAT_PRODUCTO_ID,
      proceso_id: PROC_ORD1_ID,
      periodo,
      lineas: [
        { material_id: MAT_CALIZA_ID,  porcentaje: params.pct_caliza_prehomo,  orden: 1 },
        { material_id: MAT_ARCILLA_ID, porcentaje: params.pct_arcilla_prehomo, orden: 2 },
      ],
    }],
  ]);

  return {
    versionId: VERSION_ID,
    runId: RUN_ID,
    periodos: [periodo],
    procesos: [proceso],
    materialesById,
    materialesByCodigo,
    preciosByMatPeriodo,
    pctConsumoByKey,
    recetasByProcesoPeriodo,
    formulaIdByCodigo: new Map([
      ["COSTO_CALIZA_MARTILLO_v1", "f-1"],
      ["COSTO_PREHOMO_v1",         "f-2"],
    ]),
    costoProcesoByKey: new Map(),
  };
}

const TOLERANCIA = 0.005;
function withinTol(actual: number, expected: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / Math.abs(expected) <= TOLERANCIA;
}

describe("Runner ORD 1 — end-to-end", () => {
  it("Ene-2026 reproduce benchmark hoja Costo (caliza+martillo, MP prehomo, total)", async () => {
    const periodo = "2026-01-01";
    const ctx = buildContext(periodo, {
      precio_caliza:   13819.21096,
      precio_martillo: 3178.41632,
      precio_arcilla:  10623.14632,
      pct_caliza:      0.95,
      pct_martillo:    0.05,
      pct_caliza_prehomo:  0.7920792079207921,
      pct_arcilla_prehomo: 0.2079207920792079,
    });

    const writer = new InMemoryWriter();
    const calc = new Ord01Trituracion();
    const result = await calc.run({
      ctx,
      proceso: ctx.procesos[0],
      periodo,
      writer,
    });

    // 1) Costo Caliza+Martillo
    const calizaMartillo = writer.logs.find(l => l.calculo_tipo === "precio_caliza_martillo");
    expect(calizaMartillo).toBeDefined();
    expect(withinTol(calizaMartillo!.valor_resultado, 13978.131776)).toBe(true);

    // 2) Costo MP Prehomo
    const mpPrehomo = writer.logs.find(l => l.calculo_tipo === "costo_mp_prehomo");
    expect(mpPrehomo).toBeDefined();
    expect(withinTol(mpPrehomo!.valor_resultado, 13280.56)).toBe(true);

    // 3) Costo total proceso
    expect(withinTol(result.costo_total, 13280.56)).toBe(true);
    expect(result.costo_materia_prima).not.toBeNull();
  });

  it("Sep-2025 con % implícitos 0.9/0.1 reproduce 14277.344 para caliza+martillo", async () => {
    const periodo = "2025-09-01";
    const ctx = buildContext(periodo, {
      precio_caliza:   13974.06,
      precio_martillo: 3032.84,
      precio_arcilla:  11628.05,
      pct_caliza:      0.9,
      pct_martillo:    0.1,
      pct_caliza_prehomo:  0.7920792079207921,
      pct_arcilla_prehomo: 0.2079207920792079,
    });

    const writer = new InMemoryWriter();
    const calc = new Ord01Trituracion();
    await calc.run({ ctx, proceso: ctx.procesos[0], periodo, writer });

    const cm = writer.logs.find(l => l.calculo_tipo === "precio_caliza_martillo");
    expect(withinTol(cm!.valor_resultado, 14277.344)).toBe(true);
  });

  it("Persiste 3 entradas en log con dependencias correctas", async () => {
    const periodo = "2026-01-01";
    const ctx = buildContext(periodo, {
      precio_caliza:   13819.21096,
      precio_martillo: 3178.41632,
      precio_arcilla:  10623.14632,
      pct_caliza:      0.95,
      pct_martillo:    0.05,
      pct_caliza_prehomo:  0.7920792079207921,
      pct_arcilla_prehomo: 0.2079207920792079,
    });
    const writer = new InMemoryWriter();
    const calc = new Ord01Trituracion();
    const result = await calc.run({ ctx, proceso: ctx.procesos[0], periodo, writer });

    expect(writer.logs).toHaveLength(3);
    expect(writer.deps).toHaveLength(2); // 1 dep entre mp_prehomo→caliza_martillo, 1 entre total→mp_prehomo

    const totalEntry = writer.logs.find(l => l.calculo_tipo === "costo_proceso_total");
    expect(totalEntry?.id).toBe(result.calc_total_id);

    // El log nivel_jerarquia debe estar bien (raíz=0, mp=1, caliza_martillo=2)
    const niveles = writer.logs.map(l => ({ tipo: l.calculo_tipo, nivel: l.nivel_jerarquia }));
    expect(niveles.find(n => n.tipo === "costo_proceso_total")?.nivel).toBe(0);
    expect(niveles.find(n => n.tipo === "costo_mp_prehomo")?.nivel).toBe(1);
    expect(niveles.find(n => n.tipo === "precio_caliza_martillo")?.nivel).toBe(2);
  });
});
