import { describe, it, expect } from "vitest";
import { fn as calcEnergia } from "@/lib/calc/formulas/costo_energia_proceso";

describe("COSTO_ENERGIA_PROCESO_v1", () => {
  it("Aplica precio_kwh efectivo y multiplica por kWh/Ton", () => {
    // Caso real Sep-2025: precio_contrato=331.10, restricciones=154.81, cargos_fijos=35.45
    // Crudo: 15.10 kWh/Ton
    const r = calcEnergia({
      kwh_ton: 15.10,
      precio_contrato: 331.10,
      precio_restricciones: 154.81,
      cargos_fijos: 35.45,
    });
    const precioKwh = 331.10 + 154.81 + 35.45; // 521.36
    expect(r.valor).toBeCloseTo(15.10 * precioKwh, 2);
    expect(r.expresion_evaluada).toMatch(/15\.1/);
  });

  it("Retorna 0 si kwh_ton es 0", () => {
    const r = calcEnergia({ kwh_ton: 0, precio_contrato: 100, precio_restricciones: 50, cargos_fijos: 10 });
    expect(r.valor).toBe(0);
  });

  it("Snapshot incluye los 4 parámetros", () => {
    const r = calcEnergia({ kwh_ton: 1, precio_contrato: 2, precio_restricciones: 3, cargos_fijos: 4 });
    expect(r.parametros_snapshot).toEqual({ kwh_ton: 1, precio_contrato: 2, precio_restricciones: 3, cargos_fijos: 4 });
  });
});
