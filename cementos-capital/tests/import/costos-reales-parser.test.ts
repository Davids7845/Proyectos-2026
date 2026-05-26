import { describe, it, expect } from "vitest";
import { parseCostosReales } from "@/lib/import/costos-reales-parser";
import { loadExcelFixture } from "../fixtures/load_excel_fixture";

// El fixture budget_excel_real.xlsx tiene 2 paneles en la hoja "Costo":
//   - Cols D-I → panel PPTO 2026 (Tipo=F, Consumo=G, Precio=H, Total=I)
//   - Cols K-P → panel REAL 2025 (Tipo=M, Consumo=N, Precio=O, Total=P)
// Probamos el parser sobre el panel REAL (default N/O/P).

describe("parseCostosReales", () => {
  const buffer = loadExcelFixture();
  const { filas, warnings } = parseCostosReales(buffer);

  it("no produce warnings sobre paneles vacíos", () => {
    expect(warnings).toHaveLength(0);
  });

  it("extrae filas de los procesos principales (1, 3, 4, 5, 6, 7, 16, 20)", () => {
    const ords = new Set(filas.map(f => f.proceso_ord));
    for (const ord of [1, 3, 4, 5, 6, 7, 16, 20]) {
      expect(ords.has(ord)).toBe(true);
    }
  });

  it("Clinkerización (ORD 5) tiene los 3 semielaborados + energía + fijos", () => {
    const ord5 = filas.filter(f => f.proceso_ord === 5);
    const mats = ord5.filter(f => f.concepto_tipo === "material");
    expect(mats.map(m => m.concepto_codigo).sort()).toEqual(
      ["CARBONMOL", "COMBALT", "HARINACRUD"].sort()
    );
    expect(ord5.find(f => f.concepto_tipo === "energia")).toBeDefined();
    const fijos = ord5.filter(f => f.concepto_tipo === "fijo");
    expect(fijos.length).toBeGreaterThan(0);
  });

  it("Cemento UG (ORD 6) incluye Clinker, Caliza, Aditivo, Puzolana, Finos, Yeso", () => {
    const ord6 = filas.filter(f => f.proceso_ord === 6 && f.concepto_tipo === "material");
    const codes = ord6.map(f => f.concepto_codigo).sort();
    expect(codes).toEqual(
      ["ADIT_MOL", "CALIZATRI", "CLINKER001", "FINOS_FILT", "PUZOLANA", "YESO00001"].sort()
    );
  });

  it("valores monetarios son números positivos finitos", () => {
    for (const f of filas) {
      expect(Number.isFinite(f.valor_monetario)).toBe(true);
      expect(f.valor_monetario).toBeGreaterThan(0);
    }
  });

  it("filas de material tienen consumo y precio cuando el Excel los provee", () => {
    const mats = filas.filter(f => f.concepto_tipo === "material");
    const conConsumo = mats.filter(f => f.consumo != null);
    expect(conConsumo.length).toBeGreaterThan(0);
  });

  it("rows usados son únicos por proceso (no duplica filas)", () => {
    const seen = new Set<string>();
    for (const f of filas) {
      const key = `${f.proceso_ord}|${f.row_excel}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("respeta includeZeros=false por defecto (filtra ceros)", () => {
    const ceros = filas.filter(f => f.valor_monetario === 0);
    expect(ceros.length).toBe(0);
  });
});
