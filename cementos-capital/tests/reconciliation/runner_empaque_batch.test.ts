// Pruebas de empaque batch — ORD 9/10/11/14/15/16/19.
// El helper _receta_base ya está extensamente probado; aquí validamos que:
//   1) El DERIVED_BY_CODIGO correcto se aplica (ORD 6 vs ORD 7 según producto).
//   2) La aritmética básica funciona (granel + empaque = total esperado).
//   3) Se lanza error si el proceso fuente no fue calculado.

import { describe, it, expect } from "vitest";
import { Ord09CementoUg42 }     from "@/lib/calc/procesos/ord09_cemento_ug_42";
import { Ord10CementoUg25 }     from "@/lib/calc/procesos/ord10_cemento_ug_25";
import { Ord11CementoArt42 }    from "@/lib/calc/procesos/ord11_cemento_art_42";
import { Ord14CementoTopex50 }  from "@/lib/calc/procesos/ord14_cemento_topex_50";
import { Ord15CementoUgTp }     from "@/lib/calc/procesos/ord15_cemento_ug_tp";
import { Ord16Fibrocemento }    from "@/lib/calc/procesos/ord16_fibrocemento";
import { Ord19CementoBigBag }   from "@/lib/calc/procesos/ord19_cemento_bigbag";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";

const PROC6_ID = "proc-6";
const PROC7_ID = "proc-7";

const MAT_CEM_UG_ID    = "mat-cem-ug";
const MAT_CEM_ART_ID   = "mat-cem-art";
const MAT_SACO_50_ID   = "mat-saco-50";
const MAT_SACO_42_ID   = "mat-saco-42";
const MAT_SACO_25_ID   = "mat-saco-25";
const MAT_SACO_42_ART_ID = "mat-saco-42-art";
const MAT_SACO_50_TPX_ID = "mat-saco-50-tpx";
const MAT_CARGUE_ID    = "mat-cargue-cem";

const COSTO_GRANEL_UG  = 250_000;
const COSTO_GRANEL_ART = 260_000;

const CALC_TOTAL_ORD6 = "calc-ord6-total";
const CALC_TOTAL_ORD7 = "calc-ord7-total";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeProceso(id: string, ord: number, nombre: string, topo: number): ProcesoMeta {
  return { id, ord, material: nombre.toUpperCase(), nombre, orden_topologico: topo };
}

function buildCtxUg(procesoTarget: ProcesoMeta, recetaLineas: { material_id: string; porcentaje: number; orden: number }[]): CalcContext {
  return buildCtx(procesoTarget, recetaLineas, "ug");
}

function buildCtxArt(procesoTarget: ProcesoMeta, recetaLineas: { material_id: string; porcentaje: number; orden: number }[]): CalcContext {
  return buildCtx(procesoTarget, recetaLineas, "art");
}

function buildCtx(
  procesoTarget: ProcesoMeta,
  recetaLineas: { material_id: string; porcentaje: number; orden: number }[],
  granelFuente: "ug" | "art",
): CalcContext {
  const procesos: ProcesoMeta[] = [
    makeProceso(PROC6_ID, 6, "Cemento UG",  7),
    makeProceso(PROC7_ID, 7, "Cemento ART", 8),
    procesoTarget,
  ];

  const matsList = [
    { id: MAT_CEM_UG_ID,      codigo: "CEM_UG",      nombre: "Cemento UG (Granel)",     unidad_base: "T" },
    { id: MAT_CEM_ART_ID,     codigo: "CEM_ART",     nombre: "Cemento ART (Granel)",    unidad_base: "T" },
    { id: MAT_SACO_50_ID,     codigo: "SACO_50KG",   nombre: "Saco 50 kg",              unidad_base: "UN" },
    { id: MAT_SACO_42_ID,     codigo: "SACO_42_5KG", nombre: "Saco 42,5 kg",            unidad_base: "UN" },
    { id: MAT_SACO_25_ID,     codigo: "SACO_25KG",   nombre: "Saco 25 kg",              unidad_base: "UN" },
    { id: MAT_SACO_42_ART_ID, codigo: "SACO_42_ART", nombre: "Saco 42,5 Kg ART",        unidad_base: "UN" },
    { id: MAT_SACO_50_TPX_ID, codigo: "SACO_50_TPX", nombre: "Saco 50 Kg Topex",        unidad_base: "UN" },
    { id: MAT_CARGUE_ID,      codigo: "CARGUE_CEM",  nombre: "Empaque y Cargue Cemento",unidad_base: "T" },
  ];
  const materialesById     = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_SACO_50_ID}|${PERIODO}|`,     { material_id: MAT_SACO_50_ID,     proveedor: null, periodo: PERIODO, precio: 800,  unidad: "COP/UN" }],
    [`${MAT_SACO_42_ID}|${PERIODO}|`,     { material_id: MAT_SACO_42_ID,     proveedor: null, periodo: PERIODO, precio: 720,  unidad: "COP/UN" }],
    [`${MAT_SACO_25_ID}|${PERIODO}|`,     { material_id: MAT_SACO_25_ID,     proveedor: null, periodo: PERIODO, precio: 500,  unidad: "COP/UN" }],
    [`${MAT_SACO_42_ART_ID}|${PERIODO}|`, { material_id: MAT_SACO_42_ART_ID, proveedor: null, periodo: PERIODO, precio: 720,  unidad: "COP/UN" }],
    [`${MAT_SACO_50_TPX_ID}|${PERIODO}|`, { material_id: MAT_SACO_50_TPX_ID, proveedor: null, periodo: PERIODO, precio: 800,  unidad: "COP/UN" }],
    [`${MAT_CARGUE_ID}|${PERIODO}|`,      { material_id: MAT_CARGUE_ID,      proveedor: null, periodo: PERIODO, precio: 8500, unidad: "COP/Ton" }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    [`${procesoTarget.id}|${PERIODO}`, {
      receta_id: `rec-${procesoTarget.ord}`,
      producto_id: `mat-out-${procesoTarget.ord}`,
      proceso_id: procesoTarget.id,
      periodo: PERIODO,
      lineas: recetaLineas,
    }],
  ]);

  const costoProcesoByKey = new Map([
    [`${PROC6_ID}|${PERIODO}`, { costo_total: COSTO_GRANEL_UG,  costo_por_ton: COSTO_GRANEL_UG,  calc_total_id: CALC_TOTAL_ORD6 }],
    [`${PROC7_ID}|${PERIODO}`, { costo_total: COSTO_GRANEL_ART, costo_por_ton: COSTO_GRANEL_ART, calc_total_id: CALC_TOTAL_ORD7 }],
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
    costoProcesoByKey,
  };
}

// ─── ORD 9 — Cemento UG 42,5 kg ─────────────────────────────────────────────
describe("Runner ORD 9 — Cemento UG 42,5 kg", () => {
  const PROC9: ProcesoMeta = makeProceso("proc-9", 9, "Cemento UG 42,5 kg", 11);
  const RECETA = [
    { material_id: MAT_CEM_UG_ID,  porcentaje: 1.0,              orden: 1 },
    { material_id: MAT_SACO_42_ID, porcentaje: 1000 / 42.5,      orden: 2 }, // ≈ 23.53
    { material_id: MAT_CARGUE_ID,  porcentaje: 1.0,              orden: 3 },
  ];

  it("Calcula granel UG + sacos 42 + cargue", async () => {
    const ctx = buildCtxUg(PROC9, RECETA);
    const r9 = await new Ord09CementoUg42().run({ ctx, proceso: PROC9, periodo: PERIODO, writer: new InMemoryWriter() });
    const expected = 1 * COSTO_GRANEL_UG + (1000 / 42.5) * 720 + 1 * 8500;
    expect(r9.costo_total).toBeCloseTo(expected, 2);
  });

  it("Wrapper del granel apunta a ORD 6", async () => {
    const ctx = buildCtxUg(PROC9, RECETA);
    const writer = new InMemoryWriter();
    await new Ord09CementoUg42().run({ ctx, proceso: PROC9, periodo: PERIODO, writer });
    const wrapper = writer.logs.find(l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_CEM_UG_ID)!;
    expect(wrapper.depende_de).toContain(CALC_TOTAL_ORD6);
  });
});

// ─── ORD 10 — Cemento UG 25 kg ──────────────────────────────────────────────
describe("Runner ORD 10 — Cemento UG 25 kg", () => {
  const PROC10: ProcesoMeta = makeProceso("proc-10", 10, "Cemento UG 25 kg", 12);
  const RECETA = [
    { material_id: MAT_CEM_UG_ID,  porcentaje: 1.0,  orden: 1 },
    { material_id: MAT_SACO_25_ID, porcentaje: 40,   orden: 2 }, // 1000/25 = 40 sacos/ton
    { material_id: MAT_CARGUE_ID,  porcentaje: 1.0,  orden: 3 },
  ];

  it("Calcula granel UG + 40 sacos 25 + cargue", async () => {
    const ctx = buildCtxUg(PROC10, RECETA);
    const r10 = await new Ord10CementoUg25().run({ ctx, proceso: PROC10, periodo: PERIODO, writer: new InMemoryWriter() });
    const expected = 1 * COSTO_GRANEL_UG + 40 * 500 + 1 * 8500;
    expect(r10.costo_total).toBeCloseTo(expected, 2);
  });
});

// ─── ORD 11 — Cemento ART 42,5 kg ───────────────────────────────────────────
describe("Runner ORD 11 — Cemento ART 42,5 kg", () => {
  const PROC11: ProcesoMeta = makeProceso("proc-11", 11, "Cemento ART 42,5 kg", 13);
  const RECETA = [
    { material_id: MAT_CEM_ART_ID, porcentaje: 1.0,         orden: 1 },
    { material_id: MAT_SACO_42_ID, porcentaje: 1000 / 42.5, orden: 2 },
    { material_id: MAT_CARGUE_ID,  porcentaje: 1.0,         orden: 3 },
  ];

  it("Arrastra CEM_ART de ORD 7, no de ORD 6", async () => {
    const ctx = buildCtxArt(PROC11, RECETA);
    const writer = new InMemoryWriter();
    const r11 = await new Ord11CementoArt42().run({ ctx, proceso: PROC11, periodo: PERIODO, writer });
    const expected = 1 * COSTO_GRANEL_ART + (1000 / 42.5) * 720 + 1 * 8500;
    expect(r11.costo_total).toBeCloseTo(expected, 2);
    const wrapper = writer.logs.find(l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_CEM_ART_ID)!;
    expect(wrapper.depende_de).toContain(CALC_TOTAL_ORD7);
  });

  it("Falla si ORD 7 no fue calculado", async () => {
    const ctx = buildCtxArt(PROC11, RECETA);
    ctx.costoProcesoByKey.delete(`${PROC7_ID}|${PERIODO}`);
    await expect(
      new Ord11CementoArt42().run({ ctx, proceso: PROC11, periodo: PERIODO, writer: new InMemoryWriter() })
    ).rejects.toThrow(/ORD 7 aún no calculado|no calculado/);
  });
});

// ─── ORD 14 — Cemento Topex 50 kg ───────────────────────────────────────────
describe("Runner ORD 14 — Cemento Topex 50 kg", () => {
  const PROC14: ProcesoMeta = makeProceso("proc-14", 14, "Cemento Topex 50 kg", 14);
  const RECETA = [
    { material_id: MAT_CEM_ART_ID, porcentaje: 1.0, orden: 1 },
    { material_id: MAT_SACO_50_ID, porcentaje: 20,  orden: 2 },
    { material_id: MAT_CARGUE_ID,  porcentaje: 1.0, orden: 3 },
  ];

  it("Arrastra CEM_ART de ORD 7", async () => {
    const ctx = buildCtxArt(PROC14, RECETA);
    const r14 = await new Ord14CementoTopex50().run({ ctx, proceso: PROC14, periodo: PERIODO, writer: new InMemoryWriter() });
    const expected = 1 * COSTO_GRANEL_ART + 20 * 800 + 1 * 8500;
    expect(r14.costo_total).toBeCloseTo(expected, 2);
  });
});

// ─── ORD 15 — Cemento UG TP ─────────────────────────────────────────────────
describe("Runner ORD 15 — Cemento UG TP", () => {
  const PROC15: ProcesoMeta = makeProceso("proc-15", 15, "Cemento UG TP", 15);
  const RECETA = [
    { material_id: MAT_CEM_UG_ID, porcentaje: 1.0, orden: 1 },
    { material_id: MAT_CARGUE_ID, porcentaje: 1.0, orden: 2 },
  ];

  it("Arrastra CEM_UG de ORD 6 sin sacos", async () => {
    const ctx = buildCtxUg(PROC15, RECETA);
    const r15 = await new Ord15CementoUgTp().run({ ctx, proceso: PROC15, periodo: PERIODO, writer: new InMemoryWriter() });
    const expected = 1 * COSTO_GRANEL_UG + 1 * 8500;
    expect(r15.costo_total).toBeCloseTo(expected, 2);
  });
});

// ─── ORD 16 — Fibrocemento ──────────────────────────────────────────────────
describe("Runner ORD 16 — Fibrocemento", () => {
  const PROC5_ID = "proc-5";
  const MAT_CLINKER_ID = "mat-clinker";
  const COSTO_CLINKER = 220_000;
  const PROC16: ProcesoMeta = makeProceso("proc-16", 16, "Fibrocemento", 9);
  const RECETA = [
    { material_id: MAT_CLINKER_ID, porcentaje: 0.7, orden: 1 },
    { material_id: MAT_CARGUE_ID,  porcentaje: 1.0, orden: 2 },
  ];

  function buildCtxClinker(recetaLineas: { material_id: string; porcentaje: number; orden: number }[]): CalcContext {
    const procesos: ProcesoMeta[] = [
      makeProceso(PROC5_ID, 5, "Clinker", 6),
      PROC16,
    ];
    const matsList = [
      { id: MAT_CLINKER_ID, codigo: "CLINKER001", nombre: "Clinker",               unidad_base: "T" },
      { id: MAT_CARGUE_ID,  codigo: "CARGUE_CEM", nombre: "Empaque y Cargue Cemento", unidad_base: "T" },
    ];
    const materialesById     = new Map(matsList.map(m => [m.id, m]));
    const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));
    const preciosByMatPeriodo = new Map([
      [`${MAT_CARGUE_ID}|${PERIODO}|`, { material_id: MAT_CARGUE_ID, proveedor: null, periodo: PERIODO, precio: 8500, unidad: "COP/Ton" }],
    ]);
    const costoProcesoByKey = new Map([
      [`${PROC5_ID}|${PERIODO}`, { costo_total: COSTO_CLINKER, costo_por_ton: COSTO_CLINKER, calc_total_id: "calc-ord5-total" }],
    ]);
    return {
      versionId: "v", runId: "r", periodos: [PERIODO],
      procesos, materialesById, materialesByCodigo,
      preciosByMatPeriodo, pctConsumoByKey: new Map(),
      recetasByProcesoPeriodo: new Map([
        [`${PROC16.id}|${PERIODO}`, { receta_id: "rec-16", producto_id: "mat-out-16", proceso_id: PROC16.id, periodo: PERIODO, lineas: recetaLineas }],
      ]),
      formulaIdByCodigo: new Map([
        ["COSTO_PROCESO_SUMA_v1", "f-sm"],
        ["COSTO_MP_RECETA_v1",    "f-mp"],
      ]),
      costoProcesoByKey,
    };
  }

  it("Arrastra Clinker de ORD 5", async () => {
    const ctx = buildCtxClinker(RECETA);
    const r16 = await new Ord16Fibrocemento().run({ ctx, proceso: PROC16, periodo: PERIODO, writer: new InMemoryWriter() });
    const expected = 0.7 * COSTO_CLINKER + 1 * 8500;
    expect(r16.costo_total).toBeCloseTo(expected, 2);
  });
});

// ─── ORD 19 — Big Bag ───────────────────────────────────────────────────────
describe("Runner ORD 19 — Cemento Big Bag 1,5 T", () => {
  const PROC19: ProcesoMeta = makeProceso("proc-19", 19, "Cemento Big Bag 1,5 T", 16);
  // 1 big bag (1500 kg) ≈ 0.667 bags per ton; precio del big bag en COP/UN
  const RECETA = [
    { material_id: MAT_CEM_UG_ID,  porcentaje: 1.0,          orden: 1 },
    { material_id: MAT_SACO_50_ID, porcentaje: 1000 / 1500,  orden: 2 }, // reutilizamos SACO_50 como proxy; receta real tendrá CEM_BIGBAG
    { material_id: MAT_CARGUE_ID,  porcentaje: 1.0,          orden: 3 },
  ];

  it("Arrastra CEM_UG de ORD 6 + cargue (sin bolsa — material no sembrado aún)", async () => {
    const ctx = buildCtxUg(PROC19, RECETA);
    const r19 = await new Ord19CementoBigBag().run({ ctx, proceso: PROC19, periodo: PERIODO, writer: new InMemoryWriter() });
    // Big Bag container material not seeded yet — cost = granel + cargue only
    const expected = 1 * COSTO_GRANEL_UG + 1 * 8500;
    expect(r19.costo_total).toBeCloseTo(expected, 2);
  });
});
