// Test del modo "Sin Consolidar" (precios fijos) — Fase 2b Módulo 1.
//
// Valida que cuando ctx.preciosFijos=true y existe una entrada en
// preciosFijosByKey para (proceso_id, periodo), el calculador:
//   1) Salta el cálculo de receta
//   2) Devuelve el precio fijo como costo_total y costo_por_ton
//   3) Loggea un solo entry "costo_proceso_total" con modo=sin_consolidar

import { describe, it, expect } from "vitest";
import { Ord01Trituracion } from "@/lib/calc/procesos/ord01_trituracion";
import { Ord02Adiciones } from "@/lib/calc/procesos/ord02_adiciones";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";
const PROC1_ID = "proc-1";
const PROC2_ID = "proc-2";

function emptyCtx(preciosFijos: boolean, fijosByKey: Map<string, number>): CalcContext {
  return {
    versionId: "v-1",
    runId: "r-1",
    periodos: [PERIODO],
    procesos: [],
    materialesById: new Map(),
    materialesByCodigo: new Map(),
    preciosByMatPeriodo: new Map(),
    pctConsumoByKey: new Map(),
    recetasByProcesoPeriodo: new Map(),
    formulaIdByCodigo: new Map([
      ["COSTO_PROCESO_SUMA_v1", "f-suma"],
    ]),
    costoProcesoByKey: new Map(),
    preciosFijos,
    preciosFijosByKey: fijosByKey,
  };
}

describe("Modo Sin Consolidar — ORD 1 Trituración", () => {
  it("usa precio fijo cuando preciosFijos=true y existe override", async () => {
    const FIJO = 285_000;
    const ctx = emptyCtx(true, new Map([[`${PROC1_ID}|${PERIODO}`, FIJO]]));
    const proceso: ProcesoMeta = { id: PROC1_ID, ord: 1, material: "MEZCLA PREHOMO", nombre: "Trituración", orden_topologico: 1 };
    const writer = new InMemoryWriter();

    const r = await new Ord01Trituracion().run({ ctx, proceso, periodo: PERIODO, writer });

    expect(r.costo_total).toBe(FIJO);
    expect(r.costo_por_ton).toBe(FIJO);
    expect(r.costo_materia_prima).toBe(FIJO);
    expect(writer.logs.length).toBe(1);
    expect(writer.logs[0].calculo_tipo).toBe("costo_proceso_total");
    expect(writer.logs[0].parametros_entrada).toMatchObject({ modo: "sin_consolidar" });
  });

  it("ignora el override si preciosFijos=false (cae al cálculo normal y falla por faltar datos)", async () => {
    const ctx = emptyCtx(false, new Map([[`${PROC1_ID}|${PERIODO}`, 999_000]]));
    const proceso: ProcesoMeta = { id: PROC1_ID, ord: 1, material: "MEZCLA PREHOMO", nombre: "Trituración", orden_topologico: 1 };
    const writer = new InMemoryWriter();

    await expect(
      new Ord01Trituracion().run({ ctx, proceso, periodo: PERIODO, writer }),
    ).rejects.toThrow(/faltan materiales/);
  });

  it("ignora el override si preciosFijos=true pero falta entrada para ese (proceso, periodo)", async () => {
    const ctx = emptyCtx(true, new Map()); // mapa vacío
    const proceso: ProcesoMeta = { id: PROC1_ID, ord: 1, material: "MEZCLA PREHOMO", nombre: "Trituración", orden_topologico: 1 };
    const writer = new InMemoryWriter();

    await expect(
      new Ord01Trituracion().run({ ctx, proceso, periodo: PERIODO, writer }),
    ).rejects.toThrow(/faltan materiales/);
  });
});

describe("Modo Sin Consolidar — ORD 2 Adiciones", () => {
  it("usa precio fijo cuando preciosFijos=true y existe override", async () => {
    const FIJO = 195_500;
    const ctx = emptyCtx(true, new Map([[`${PROC2_ID}|${PERIODO}`, FIJO]]));
    const proceso: ProcesoMeta = { id: PROC2_ID, ord: 2, material: "CALIZA PARA ADICIONES", nombre: "Adiciones", orden_topologico: 2 };
    const writer = new InMemoryWriter();

    const r = await new Ord02Adiciones().run({ ctx, proceso, periodo: PERIODO, writer });

    expect(r.costo_total).toBe(FIJO);
    expect(r.costo_por_ton).toBe(FIJO);
    expect(writer.logs.length).toBe(1);
    expect(writer.logs[0].parametros_entrada).toMatchObject({ modo: "sin_consolidar" });
  });

  it("permite preciosFijos por proceso individualmente (ORD2 fijo, ORD1 dispara override-no-encontrado)", async () => {
    // Solo ORD 2 tiene precio fijo; ORD 1 no
    const ctx = emptyCtx(true, new Map([[`${PROC2_ID}|${PERIODO}`, 195_500]]));
    const proc2: ProcesoMeta = { id: PROC2_ID, ord: 2, material: "CALIZA PARA ADICIONES", nombre: "Adiciones", orden_topologico: 2 };
    const writer = new InMemoryWriter();

    const r = await new Ord02Adiciones().run({ ctx, proceso: proc2, periodo: PERIODO, writer });
    expect(r.costo_total).toBe(195_500);
  });
});
