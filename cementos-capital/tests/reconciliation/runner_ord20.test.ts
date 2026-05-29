// Tests de ORD 20 (Combustibles Alternos).
// Fase 3: ORD 21 dejó de tener calculadora — es una vista derivada que se
// computa on-the-fly en /api/versiones/[id]/cementos-consolidado.

import { describe, it, expect } from "vitest";
import { Ord20CombustiblesAlternos } from "@/lib/calc/procesos/ord20_combustibles_alternos";
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

// ORD 21: vista derivada — sin tests de calculadora aquí. Cobertura en
// tests/api/cementos_consolidado.test.ts (Sub-sesión 7).
