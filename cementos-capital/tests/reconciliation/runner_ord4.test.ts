// Test end-to-end de ORD 4 (Molienda de Carbón) — proceso autónomo sin dependencias
// de costo de procesos anteriores; todos sus materiales son compras directas.

import { describe, it, expect } from "vitest";
import { Ord04MoliendaCarbon } from "@/lib/calc/procesos/ord04_molienda_carbon";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";
const PROC4_ID = "proc-4";
const MAT_CARBITUMI_ID = "mat-carbitumi";
const MAT_CARB_MIXTO_ID = "mat-carb-mixto";
const MAT_CARB_FINO_ID  = "mat-carb-fino";

function buildContext(): CalcContext {
  const procesos: ProcesoMeta[] = [
    { id: PROC4_ID, ord: 4, material: "CARBON MOLIDO", nombre: "Molienda de Carbón", orden_topologico: 3 },
  ];
  const matsList = [
    { id: MAT_CARBITUMI_ID,  codigo: "CARBITUMI",  nombre: "Carbón Bituminoso", unidad_base: "T" },
    { id: MAT_CARB_MIXTO_ID, codigo: "CARB_MIXTO", nombre: "Carbón Mixto",      unidad_base: "T" },
    { id: MAT_CARB_FINO_ID,  codigo: "CARB_FINO",  nombre: "Carbón Fino",       unidad_base: "T" },
  ];
  const materialesById = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_CARBITUMI_ID}|${PERIODO}|`,  { material_id: MAT_CARBITUMI_ID,  proveedor: null, periodo: PERIODO, precio: 180000, unidad: "COP/Ton" }],
    [`${MAT_CARB_MIXTO_ID}|${PERIODO}|`, { material_id: MAT_CARB_MIXTO_ID, proveedor: null, periodo: PERIODO, precio: 150000, unidad: "COP/Ton" }],
    [`${MAT_CARB_FINO_ID}|${PERIODO}|`,  { material_id: MAT_CARB_FINO_ID,  proveedor: null, periodo: PERIODO, precio: 120000, unidad: "COP/Ton" }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    [`${PROC4_ID}|${PERIODO}`, {
      receta_id: "rec-4",
      producto_id: "mat-carbonmol",
      proceso_id: PROC4_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_CARBITUMI_ID,  porcentaje: 0.60, orden: 1 },
        { material_id: MAT_CARB_MIXTO_ID, porcentaje: 0.30, orden: 2 },
        { material_id: MAT_CARB_FINO_ID,  porcentaje: 0.10, orden: 3 },
      ],
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
      ["COSTO_MP_RECETA_v1",    "f-mp"],
      ["COSTO_PROCESO_SUMA_v1", "f-sm"],
    ]),
    costoProcesoByKey: new Map(),
  };
}

describe("Runner ORD 4 — Molienda de Carbón", () => {
  it("Calcula costo MP correctamente desde precios directos", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    const r4 = await new Ord04MoliendaCarbon().run({
      ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer,
    });

    // 0.60×180000 + 0.30×150000 + 0.10×120000 = 108000 + 45000 + 12000 = 165000
    const expected = 0.60 * 180000 + 0.30 * 150000 + 0.10 * 120000;
    expect(r4.costo_total).toBeCloseTo(expected, 2);
    expect(r4.costo_materia_prima).toBeCloseTo(expected, 2);
    expect(r4.costo_por_ton).toBeCloseTo(expected, 2);
  });

  it("Crea 5 log entries y 4 deps (sin cross-process)", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    await new Ord04MoliendaCarbon().run({
      ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer,
    });

    // 3 precio_componente_directo + 1 costo_mp_carbon + 1 costo_proceso_total = 5
    expect(writer.logs).toHaveLength(5);
    expect(writer.logs.filter(l => l.calculo_tipo === "precio_componente_directo").length).toBe(3);
    expect(writer.logs.find(l => l.calculo_tipo === "costo_mp_carbon")).toBeDefined();
    expect(writer.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();

    // 3 (mp→precios) + 1 (total→mp) = 4 deps; ninguna cross-process
    expect(writer.deps).toHaveLength(4);
    expect(writer.logs.filter(l => l.calculo_tipo === "precio_componente_derivado").length).toBe(0);
  });

  it("costo_proceso_total dep apunta a costo_mp_carbon con rol 'costo_mp'", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    await new Ord04MoliendaCarbon().run({
      ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer,
    });

    const total = writer.logs.find(l => l.calculo_tipo === "costo_proceso_total")!;
    const mp    = writer.logs.find(l => l.calculo_tipo === "costo_mp_carbon")!;
    expect(total.rol_dependencias?.[mp.id]).toBe("costo_mp");
  });

  it("Falla con error claro si falta receta", async () => {
    const ctx = buildContext();
    ctx.recetasByProcesoPeriodo.delete(`${PROC4_ID}|${PERIODO}`);
    const writer = new InMemoryWriter();
    await expect(
      new Ord04MoliendaCarbon().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer })
    ).rejects.toThrow(/no hay receta/);
  });

  it("Falla si falta precio de un carbón", async () => {
    const ctx = buildContext();
    ctx.preciosByMatPeriodo.delete(`${MAT_CARB_FINO_ID}|${PERIODO}|`);
    const writer = new InMemoryWriter();
    await expect(
      new Ord04MoliendaCarbon().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer })
    ).rejects.toThrow(/falta precio/);
  });
});
