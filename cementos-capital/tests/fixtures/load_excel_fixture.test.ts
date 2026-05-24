import { describe, it, expect } from "vitest";
import { loadExcelFixture, extractTargetValues, extractPresupuesto } from "./load_excel_fixture";

describe("Fixture Excel: load + extract", () => {
  it("Carga el archivo sin error y tiene tamaño razonable", () => {
    const buf = loadExcelFixture();
    expect(buf.length).toBeGreaterThan(100_000);
  });

  it("Extrae los 11 procesos × 2 periodos = 22 valores", () => {
    const buf = loadExcelFixture();
    const targets = extractTargetValues(buf);
    expect(targets.length).toBe(22);
    for (const t of targets) {
      expect(t.valor).toBeGreaterThan(0);
      expect(["real", "presupuesto"]).toContain(t.periodoTipo);
    }
  });

  it("Valores Presupuesto coinciden con tabla del prompt ±0.01 COP", () => {
    const buf = loadExcelFixture();
    const ppto = extractPresupuesto(buf);
    const byProc = new Map(ppto.map(p => [p.proceso, p.valor]));
    expect(byProc.get("Trituración")).toBeCloseTo(13_902.78, 1);
    expect(byProc.get("Adiciones")).toBeCloseTo(15_086.89, 1);
    expect(byProc.get("Molienda Crudo")).toBeCloseTo(29_052.96, 1);
    expect(byProc.get("Molienda Carbón")).toBeCloseTo(302_320.56, 1);
    expect(byProc.get("Clinkerización")).toBeCloseTo(113_462.98, 1);
    expect(byProc.get("Cemento UG (granel)")).toBeCloseTo(95_900.55, 1);
    expect(byProc.get("Cemento ART (granel)")).toBeCloseTo(135_436.71, 1);
    expect(byProc.get("Empaque UG 50 kg")).toBeCloseTo(120_188.37, 1);
    expect(byProc.get("Empaque UG 42,5 kg")).toBeCloseTo(126_587.39, 1);
    expect(byProc.get("Fibrocemento")).toBeCloseTo(141_020.0, 0);
  });
});
