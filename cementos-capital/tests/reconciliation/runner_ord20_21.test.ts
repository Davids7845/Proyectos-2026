// Tests de ORD 20 (Combustibles Alternos) y ORD 21 (Cementos consolidador).

import { describe, it, expect } from "vitest";
import { Ord20CombustiblesAlternos } from "@/lib/calc/procesos/ord20_combustibles_alternos";
import { Ord21Cementos }             from "@/lib/calc/procesos/ord21_cementos";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";

// ─── ORD 20 ─────────────────────────────────────────────────────────────────

const PROC20_ID = "proc-20";
const MAT_CDR_ID      = "mat-cdr";
const MAT_TDF_ID      = "mat-tdf";
const MAT_BRIQUETAS_ID = "mat-briquetas";

function buildCtxOrd20(): CalcContext {
  const procesos: ProcesoMeta[] = [
    { id: PROC20_ID, ord: 20, material: "COMBUSTIBLES ALTERNOS", nombre: "Combustibles Alternos", orden_topologico: 4 },
  ];
  const matsList = [
    { id: MAT_CDR_ID,       codigo: "CDR",      nombre: "CDR",       unidad_base: "T" },
    { id: MAT_TDF_ID,       codigo: "TDF",      nombre: "TDF",       unidad_base: "T" },
    { id: MAT_BRIQUETAS_ID, codigo: "BRIQUETAS",nombre: "Briquetas", unidad_base: "T" },
  ];
  const materialesById     = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_CDR_ID}|${PERIODO}|`,       { material_id: MAT_CDR_ID,       proveedor: null, periodo: PERIODO, precio: 120_000, unidad: "COP/Ton" }],
    [`${MAT_TDF_ID}|${PERIODO}|`,       { material_id: MAT_TDF_ID,       proveedor: null, periodo: PERIODO, precio: 90_000,  unidad: "COP/Ton" }],
    [`${MAT_BRIQUETAS_ID}|${PERIODO}|`, { material_id: MAT_BRIQUETAS_ID, proveedor: null, periodo: PERIODO, precio: 85_000,  unidad: "COP/Ton" }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    [`${PROC20_ID}|${PERIODO}`, {
      receta_id: "rec-20",
      producto_id: "mat-combalt",
      proceso_id: PROC20_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_CDR_ID,       porcentaje: 0.50, orden: 1 },
        { material_id: MAT_TDF_ID,       porcentaje: 0.30, orden: 2 },
        { material_id: MAT_BRIQUETAS_ID, porcentaje: 0.20, orden: 3 },
      ],
    }],
  ]);

  return {
    versionId: "v", runId: "r", periodos: [PERIODO],
    procesos, materialesById, materialesByCodigo,
    preciosByMatPeriodo, pctConsumoByKey: new Map(),
    recetasByProcesoPeriodo,
    formulaIdByCodigo: new Map([
      ["COSTO_PROCESO_SUMA_v1", "f-sm"],
      ["COSTO_MP_RECETA_v1",    "f-mp"],
    ]),
    costoProcesoByKey: new Map(),
  };
}

describe("Runner ORD 20 — Combustibles Alternos", () => {
  it("Calcula mezcla ponderada de CDR + TDF + Briquetas", async () => {
    const ctx = buildCtxOrd20();
    const r20 = await new Ord20CombustiblesAlternos().run({
      ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer: new InMemoryWriter(),
    });
    // 0.50×120000 + 0.30×90000 + 0.20×85000 = 60000 + 27000 + 17000 = 104000
    const expected = 0.50 * 120_000 + 0.30 * 90_000 + 0.20 * 85_000;
    expect(r20.costo_total).toBeCloseTo(expected, 2);
  });

  it("Crea 5 log entries todos directos (sin derivados)", async () => {
    const ctx = buildCtxOrd20();
    const writer = new InMemoryWriter();
    await new Ord20CombustiblesAlternos().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer });

    expect(writer.logs).toHaveLength(5);
    expect(writer.logs.filter(l => l.calculo_tipo === "precio_componente_directo").length).toBe(3);
    expect(writer.logs.filter(l => l.calculo_tipo === "precio_componente_derivado").length).toBe(0);
    expect(writer.logs.find(l => l.calculo_tipo === "costo_mp_combustibles_alternos")).toBeDefined();
    expect(writer.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();
  });

  it("Falla si falta receta", async () => {
    const ctx = buildCtxOrd20();
    ctx.recetasByProcesoPeriodo.delete(`${PROC20_ID}|${PERIODO}`);
    await expect(
      new Ord20CombustiblesAlternos().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer: new InMemoryWriter() })
    ).rejects.toThrow(/no hay receta/);
  });
});

// ─── ORD 21 ─────────────────────────────────────────────────────────────────

function buildCtxOrd21(costosDisponibles: Array<{ ord: number; costo: number }>): CalcContext {
  const PROC21_ID = "proc-21";
  const procesos: ProcesoMeta[] = [
    ...costosDisponibles.map(c => ({
      id: `proc-${c.ord}`,
      ord: c.ord,
      material: `CEMENTO ORD${c.ord}`,
      nombre: `Cemento ORD ${c.ord}`,
      orden_topologico: c.ord,
    })),
    { id: PROC21_ID, ord: 21, material: "CEMENTOS", nombre: "Cementos", orden_topologico: 17 },
  ];

  const costoProcesoByKey = new Map(
    costosDisponibles.map(c => [
      `proc-${c.ord}|${PERIODO}`,
      { costo_total: c.costo, costo_por_ton: c.costo, calc_total_id: `calc-${c.ord}` },
    ])
  );

  return {
    versionId: "v", runId: "r", periodos: [PERIODO],
    procesos,
    materialesById: new Map(), materialesByCodigo: new Map(),
    preciosByMatPeriodo: new Map(), pctConsumoByKey: new Map(),
    recetasByProcesoPeriodo: new Map(),
    formulaIdByCodigo: new Map([["COSTO_PROCESO_SUMA_v1", "f-sm"]]),
    costoProcesoByKey,
  };
}

describe("Runner ORD 21 — Cementos (consolidador)", () => {
  it("Promedia costos de todos los cementos disponibles", async () => {
    const costos = [
      { ord: 6,  costo: 250_000 },
      { ord: 8,  costo: 274_500 },
      { ord: 9,  costo: 277_600 },
      { ord: 11, costo: 285_000 },
    ];
    const ctx = buildCtxOrd21(costos);
    const proc21 = ctx.procesos.find(p => p.ord === 21)!;

    const r21 = await new Ord21Cementos().run({
      ctx, proceso: proc21, periodo: PERIODO, writer: new InMemoryWriter(),
    });

    const expected = costos.reduce((s, c) => s + c.costo, 0) / costos.length;
    expect(r21.costo_total).toBeCloseTo(expected, 2);
  });

  it("Crea N+1 log entries: uno por fuente + costo_proceso_total", async () => {
    const costos = [
      { ord: 6, costo: 250_000 },
      { ord: 8, costo: 274_500 },
    ];
    const ctx = buildCtxOrd21(costos);
    const proc21 = ctx.procesos.find(p => p.ord === 21)!;
    const writer = new InMemoryWriter();

    await new Ord21Cementos().run({ ctx, proceso: proc21, periodo: PERIODO, writer });

    // 2 costo_referencia_cemento + 1 costo_proceso_total = 3
    expect(writer.logs).toHaveLength(3);
    expect(writer.logs.filter(l => l.calculo_tipo === "costo_referencia_cemento").length).toBe(2);
    expect(writer.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();
    // 2 (refs → sus totales) + 2 (total → refs) = 4 deps
    expect(writer.deps).toHaveLength(4);
  });

  it("Falla si ningún proceso de cemento fue calculado", async () => {
    const ctx = buildCtxOrd21([]);
    // Añadir ORD 21 pero sin datos
    ctx.procesos.push({ id: "proc-21", ord: 21, material: "CEMENTOS", nombre: "Cementos", orden_topologico: 17 });
    const proc21 = ctx.procesos.find(p => p.ord === 21)!;
    await expect(
      new Ord21Cementos().run({ ctx, proceso: proc21, periodo: PERIODO, writer: new InMemoryWriter() })
    ).rejects.toThrow(/ningún proceso de cemento calculado/);
  });

  it("Omite graciosamente los ORDs no calculados y usa solo los disponibles", async () => {
    // Solo ORD 6 calculado, el resto sin datos
    const costos = [{ ord: 6, costo: 250_000 }];
    const ctx = buildCtxOrd21(costos);
    const proc21 = ctx.procesos.find(p => p.ord === 21)!;

    const r21 = await new Ord21Cementos().run({
      ctx, proceso: proc21, periodo: PERIODO, writer: new InMemoryWriter(),
    });
    // Solo 1 valor disponible → promedio = ese mismo valor
    expect(r21.costo_total).toBeCloseTo(250_000, 2);
  });
});
