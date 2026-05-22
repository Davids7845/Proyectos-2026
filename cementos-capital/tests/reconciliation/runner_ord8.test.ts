// Test end-to-end de ORD 8 (Cemento UG 50 kg empacado).
// El helper `_receta_base` ya está cubierto por ORD 3/5/6; aquí validamos
// que la semántica "empaque" (pct = unidades por ton) funcione correctamente.

import { describe, it, expect } from "vitest";
import { Ord08CementoUg50 } from "@/lib/calc/procesos/ord08_cemento_ug_50";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";

const PROC6_ID = "proc-6";
const PROC8_ID = "proc-8";

const MAT_CEM_UG_ID    = "mat-cem-ug";
const MAT_SACO_50_ID   = "mat-saco-50";
const MAT_CARGUE_ID    = "mat-cargue-cem";
const MAT_CEM_UG_50_ID = "mat-cem-ug-50";

const FAKE_COSTO_GRANEL = 250000; // COP/Ton (fake ORD 6 output)
const FAKE_CALC_TOTAL_ID_ORD6 = "calc-fake-ord6-total";

function buildContext(): CalcContext {
  const procesos: ProcesoMeta[] = [
    { id: PROC6_ID, ord: 6, material: "CEMENTO UG",       nombre: "Cemento UG",       orden_topologico: 7 },
    { id: PROC8_ID, ord: 8, material: "CEMENTO UG 50 KG", nombre: "Cemento UG 50 KG", orden_topologico: 10 },
  ];

  const matsList = [
    { id: MAT_CEM_UG_ID,    codigo: "CEM_UG",      nombre: "Cemento UG (Granel)", unidad_base: "T" },
    { id: MAT_SACO_50_ID,   codigo: "SACO_50KG",   nombre: "Saco 50 kg",          unidad_base: "UN" },
    { id: MAT_CARGUE_ID,    codigo: "CARGUE_CEM",  nombre: "Empaque y Cargue Cemento", unidad_base: "T" },
    { id: MAT_CEM_UG_50_ID, codigo: "CEM_UG_50",   nombre: "Cemento UG 50 kg",    unidad_base: "T" },
  ];
  const materialesById     = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_SACO_50_ID}|${PERIODO}|`, { material_id: MAT_SACO_50_ID, proveedor: null, periodo: PERIODO, precio: 800,  unidad: "COP/UN" }],
    [`${MAT_CARGUE_ID}|${PERIODO}|`,  { material_id: MAT_CARGUE_ID,  proveedor: null, periodo: PERIODO, precio: 8500, unidad: "COP/Ton" }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    [`${PROC8_ID}|${PERIODO}`, {
      receta_id: "rec-8",
      producto_id: MAT_CEM_UG_50_ID,
      proceso_id: PROC8_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_CEM_UG_ID,  porcentaje: 1.0,  orden: 1 },  // 1 ton granel por ton empacado
        { material_id: MAT_SACO_50_ID, porcentaje: 20,   orden: 2 },  // 20 sacos por ton
        { material_id: MAT_CARGUE_ID,  porcentaje: 1.0,  orden: 3 },  // 1 servicio por ton
      ],
    }],
  ]);

  const costoProcesoByKey = new Map([
    [`${PROC6_ID}|${PERIODO}`, {
      costo_total: FAKE_COSTO_GRANEL,
      costo_por_ton: FAKE_COSTO_GRANEL,
      calc_total_id: FAKE_CALC_TOTAL_ID_ORD6,
    }],
  ]);

  return {
    versionId: "v",
    runId: "r",
    periodos: [PERIODO],
    procesos,
    materialesById,
    materialesByCodigo,
    preciosByMatPeriodo,
    pctConsumoByKey: new Map(),
    recetasByProcesoPeriodo,
    formulaIdByCodigo: new Map([
      ["COSTO_PROCESO_SUMA_v1", "f-sm"],
      ["COSTO_MP_RECETA_v1",    "f-mp"],
    ]),
    costoProcesoByKey,
  };
}

describe("Runner ORD 8 — Cemento UG 50 kg empacado", () => {
  it("Suma granel arrastrado + sacos × cantidad + servicio cargue", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    const r8 = await new Ord08CementoUg50().run({
      ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer,
    });

    // 1 × 250000 (granel) + 20 × 800 (sacos) + 1 × 8500 (cargue) = 250000 + 16000 + 8500 = 274500
    const expected = 1 * FAKE_COSTO_GRANEL + 20 * 800 + 1 * 8500;
    expect(r8.costo_total).toBeCloseTo(expected, 2);
    expect(r8.costo_materia_prima).toBeCloseTo(expected, 2);
  });

  it("Crea 5 log entries con wrapper derivado para el granel", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    await new Ord08CementoUg50().run({
      ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer,
    });

    // 1 derivado (CEM_UG) + 2 directos (saco, cargue) + costo_proceso_empaque + costo_proceso_total = 5
    expect(writer.logs).toHaveLength(5);
    expect(writer.logs.filter(l => l.calculo_tipo === "precio_componente_derivado").length).toBe(1);
    expect(writer.logs.filter(l => l.calculo_tipo === "precio_componente_directo").length).toBe(2);
    expect(writer.logs.find(l => l.calculo_tipo === "costo_proceso_empaque_ug_50")).toBeDefined();
    expect(writer.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();

    // 1 (wrapper_granel → ORD6_total) + 3 (mp → 3 precios) + 1 (total → mp) = 5
    expect(writer.deps).toHaveLength(5);

    const wrapperGranel = writer.logs.find(
      l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_CEM_UG_ID
    )!;
    expect(wrapperGranel.depende_de).toContain(FAKE_CALC_TOTAL_ID_ORD6);
    expect(wrapperGranel.rol_dependencias?.[FAKE_CALC_TOTAL_ID_ORD6]).toBe("costo_arrastrado");
  });

  it("Falla si ORD 6 no fue calculado", async () => {
    const ctx = buildContext();
    ctx.costoProcesoByKey.clear();
    const writer = new InMemoryWriter();
    await expect(
      new Ord08CementoUg50().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer })
    ).rejects.toThrow(/ORD 6 aún no calculado|no calculado/);
  });

  it("Falla si falta precio de sacos", async () => {
    const ctx = buildContext();
    ctx.preciosByMatPeriodo.delete(`${MAT_SACO_50_ID}|${PERIODO}|`);
    const writer = new InMemoryWriter();
    await expect(
      new Ord08CementoUg50().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer })
    ).rejects.toThrow(/falta precio.*SACO_50KG/);
  });
});
