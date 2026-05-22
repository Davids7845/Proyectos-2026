import { describe, it, expect } from "vitest";
import { fn as calcMezcla } from "@/lib/calc/formulas/costo_mezcla_ponderada";
import { Ord02Adiciones } from "@/lib/calc/procesos/ord02_adiciones";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext } from "@/lib/calc/engine/context";

describe("COSTO_MEZCLA_PONDERADA_v1", () => {
  it("Una sola componente (100%) devuelve su precio", () => {
    const r = calcMezcla({ items_json: JSON.stringify([{ nombre: "x", precio: 12345.67, pct: 1.0 }]) });
    expect(r.valor).toBeCloseTo(12345.67, 4);
    expect(r.expresion_evaluada).toContain("12345.67");
  });

  it("Dos componentes ponderan correctamente", () => {
    const r = calcMezcla({
      items_json: JSON.stringify([
        { nombre: "a", precio: 1000, pct: 0.7 },
        { nombre: "b", precio: 2000, pct: 0.3 },
      ]),
    });
    expect(r.valor).toBeCloseTo(700 + 600, 6);
  });

  it("Items vacíos devuelve 0", () => {
    const r = calcMezcla({ items_json: "[]" });
    expect(r.valor).toBe(0);
  });

  it("Precisión decimal: evita errores típicos de float", () => {
    // 0.1 + 0.2 con decimal.js
    const r = calcMezcla({
      items_json: JSON.stringify([
        { nombre: "a", precio: 1, pct: 0.1 },
        { nombre: "b", precio: 1, pct: 0.2 },
      ]),
    });
    expect(r.valor).toBe(0.3);
  });
});

describe("ORD 2 — Adiciones", () => {
  it("Calcula costo y produce 2 entradas en log con 1 dep", async () => {
    const MAT_CAL_ID = "mat-calizatri";
    const PROC_ID = "proc-ord2";
    const periodo = "2026-01-01";

    const ctx: CalcContext = {
      versionId: "v",
      runId: "r",
      periodos: [periodo],
      procesos: [{ id: PROC_ID, ord: 2, material: "CALIZA PARA ADICIONES", nombre: "Adiciones", orden_topologico: 2 }],
      materialesById: new Map([[MAT_CAL_ID, { id: MAT_CAL_ID, codigo: "CALIZATRI", nombre: "Caliza Triturada", unidad_base: "T" }]]),
      materialesByCodigo: new Map([["CALIZATRI", { id: MAT_CAL_ID, codigo: "CALIZATRI", nombre: "Caliza Triturada", unidad_base: "T" }]]),
      preciosByMatPeriodo: new Map([[`${MAT_CAL_ID}|${periodo}|`, { material_id: MAT_CAL_ID, proveedor: null, periodo, precio: 25000, unidad: "COP/Ton" }]]),
      pctConsumoByKey: new Map(),
      recetasByProcesoPeriodo: new Map(),
      formulaIdByCodigo: new Map([["COSTO_MEZCLA_PONDERADA_v1", "f-mezcla"]]),
      costoProcesoByKey: new Map(),
    };

    const writer = new InMemoryWriter();
    const calc = new Ord02Adiciones();
    const result = await calc.run({ ctx, proceso: ctx.procesos[0], periodo, writer });

    expect(result.costo_total).toBe(25000);
    expect(result.costo_por_ton).toBe(25000);
    expect(writer.logs).toHaveLength(2);
    expect(writer.deps).toHaveLength(1);
    expect(writer.logs.find(l => l.calculo_tipo === "costo_proceso_total")?.id).toBe(result.calc_total_id);
  });
});
