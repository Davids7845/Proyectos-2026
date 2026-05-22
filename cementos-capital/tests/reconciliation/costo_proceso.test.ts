import { describe, it, expect } from "vitest";
import { fn as calcCalizaMartillo } from "@/lib/calc/formulas/costo_caliza_martillo";
import { fn as calcPrehomo }        from "@/lib/calc/formulas/costo_prehomo";

// ─────────────────────────────────────────────────────────────────
// Valores reales del Excel — hoja Datos (data_only=True con openpyxl)
// ─────────────────────────────────────────────────────────────────

// Sep-Dic 2025: % Consumo caliza/martillo son None → el Excel usa 0.9/0.1 implícito
const SEP2025 = {
  caliza_explotada:  13974.06,
  costo_martillo:    3032.84,
  arcilla_explotada: 11628.05,
  pct_caliza:        0.9,    // implícito en el Excel para Sep-Dic 2025
  pct_martillo:      0.1,
  // Recetas Sep-2025 también son None → no hay benchmark de Costo sheet para este período
};

// Ene-Ago 2026: % Consumo explícitos en fila 129-130
const ENE2026 = {
  caliza_explotada:  13819.21096,
  costo_martillo:    3178.41632,
  arcilla_explotada: 10623.14632,
  pct_caliza:        0.95,   // fila 129 col H
  pct_martillo:      0.05,   // fila 130 col H
  pct_caliza_prehomo:  0.7920792079207921,  // fila 165 col H
  pct_arcilla_prehomo: 0.2079207920792079,  // fila 166 col H
  // Resultados conocidos hoja Costo (PPTO 2026 usa precios Ene-2026):
  caliza_martillo_resultado: 13978.131776,  // fila 3 col H Datos
  prehomo_mp_total:          13280.56,      // caliza 11071.79 + arcilla 2208.77 (hoja Costo filas 7-8)
  total_trituracion:         15372.59,      // fila 14 hoja Costo
};

const TOLERANCIA = 0.005; // ±0.5%

function withinTolerance(actual: number, expected: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / Math.abs(expected) <= TOLERANCIA;
}

// ─────────────────────────────────────────────────────────────────
describe("COSTO_CALIZA_MARTILLO_v1", () => {
  it("Sep-2025: reproduce fila 3 hoja Datos con pct=0.9/0.1", () => {
    const result = calcCalizaMartillo({
      precio_caliza:  SEP2025.caliza_explotada,
      costo_martillo: SEP2025.costo_martillo,
      pct_caliza:     SEP2025.pct_caliza,
      pct_martillo:   SEP2025.pct_martillo,
    });
    // Fila 3 col D = 14277.344
    expect(withinTolerance(result.valor, 14277.344)).toBe(true);
  });

  it("Ene-2026: reproduce fila 3 hoja Datos con pct=0.95/0.05", () => {
    const result = calcCalizaMartillo({
      precio_caliza:  ENE2026.caliza_explotada,
      costo_martillo: ENE2026.costo_martillo,
      pct_caliza:     ENE2026.pct_caliza,
      pct_martillo:   ENE2026.pct_martillo,
    });
    expect(withinTolerance(result.valor, ENE2026.caliza_martillo_resultado)).toBe(true);
  });

  it("La suma pct_caliza + pct_martillo es 1.0 en ambos períodos", () => {
    expect(SEP2025.pct_caliza + SEP2025.pct_martillo).toBe(1.0);
    expect(ENE2026.pct_caliza + ENE2026.pct_martillo).toBe(1.0);
  });

  it("Produce expresion_evaluada legible con todos los parámetros", () => {
    const result = calcCalizaMartillo({
      precio_caliza: 13819.21096,
      costo_martillo: 3178.41632,
      pct_caliza: 0.95,
      pct_martillo: 0.05,
    });
    expect(result.expresion_evaluada).toContain("13819.21096");
    expect(result.expresion_evaluada).toContain("3178.41632");
    expect(result.expresion_evaluada).toContain("0.95");
  });
});

// ─────────────────────────────────────────────────────────────────
describe("COSTO_PREHOMO_v1 (ORD 1 - Trituración)", () => {
  it("Ene-2026: MP caliza+arcilla dentro de ±0.5% del benchmark hoja Costo", () => {
    // La hoja Costo (PPTO 2026) usa precios de Ene-2026.
    // Caliza: consumo=0.79208 × costo=13978.13 = 11071.79
    // Arcilla: consumo=0.20792 × costo=10623.15 = 2208.77
    // Total MP Prehomo ≈ 13280.56
    const result = calcPrehomo({
      precio_caliza_martillo: ENE2026.caliza_martillo_resultado,
      precio_arcilla:         ENE2026.arcilla_explotada,
      pct_caliza:             ENE2026.pct_caliza_prehomo,
      pct_arcilla:            ENE2026.pct_arcilla_prehomo,
    });
    expect(withinTolerance(result.valor, ENE2026.prehomo_mp_total)).toBe(true);
  });

  it("Suma de porcentajes de receta Prehomo es ≈ 1.0", () => {
    const suma = ENE2026.pct_caliza_prehomo + ENE2026.pct_arcilla_prehomo;
    expect(Math.abs(suma - 1.0)).toBeLessThan(0.0001);
  });

  it("Ene-2026: costo Prehomo menor que con Sep-2025 (precios bajaron)", () => {
    // Sep-2025: caliza+martillo a 14277.344, arcilla a 11628.05
    const caliza_sep = calcCalizaMartillo({
      precio_caliza: SEP2025.caliza_explotada,
      costo_martillo: SEP2025.costo_martillo,
      pct_caliza: SEP2025.pct_caliza,
      pct_martillo: SEP2025.pct_martillo,
    }).valor;

    const prehomo_sep = calcPrehomo({
      precio_caliza_martillo: caliza_sep,
      precio_arcilla: SEP2025.arcilla_explotada,
      pct_caliza: ENE2026.pct_caliza_prehomo,   // usar receta de Ene-2026 (Sep no tiene)
      pct_arcilla: ENE2026.pct_arcilla_prehomo,
    }).valor;

    const prehomo_ene = calcPrehomo({
      precio_caliza_martillo: ENE2026.caliza_martillo_resultado,
      precio_arcilla: ENE2026.arcilla_explotada,
      pct_caliza: ENE2026.pct_caliza_prehomo,
      pct_arcilla: ENE2026.pct_arcilla_prehomo,
    }).valor;

    expect(prehomo_ene).toBeLessThan(prehomo_sep);
  });

  it("Ene-2026: expresion_evaluada muestra el cálculo completo", () => {
    const result = calcPrehomo({
      precio_caliza_martillo: ENE2026.caliza_martillo_resultado,
      precio_arcilla:         ENE2026.arcilla_explotada,
      pct_caliza:             ENE2026.pct_caliza_prehomo,
      pct_arcilla:            ENE2026.pct_arcilla_prehomo,
    });
    expect(result.expresion_evaluada).toContain("13978.131776");
    expect(result.expresion_evaluada).toContain("10623.14632");
    expect(result.valor).toBeGreaterThan(13000);
    expect(result.valor).toBeLessThan(14000);
  });
});
