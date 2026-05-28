import { describe, it, expect, beforeAll } from "vitest";
import { loadExcelFixture } from "../fixtures/load_excel_fixture";
import { parseExcel } from "@/lib/import/excel-importer";
import type { ParsedExcel } from "@/lib/import/types";

describe("Importer Excel real — 12 secciones", () => {
  let parsed: ParsedExcel;

  beforeAll(() => {
    const buffer = loadExcelFixture();
    // Sin versionRange: el importer lee todos los meses disponibles en el Excel (16).
    parsed = parseExcel(buffer);
  });

  it("Parsea sin errors generales", () => {
    expect(parsed.errors).toHaveLength(0);
  });

  it("Detecta los períodos del Excel (≥12, ≤24)", () => {
    expect(parsed.periodos.length).toBeGreaterThanOrEqual(12);
    expect(parsed.periodos.length).toBeLessThanOrEqual(24);
    expect(parsed.periodos[0]).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("Precios > 100 filas", () => {
    expect(parsed.precios.length).toBeGreaterThan(100);
  });

  it("% Consumo > 30 filas", () => {
    expect(parsed.porcentajes_consumo.length).toBeGreaterThan(30);
  });

  it("Recetas > 100 filas (incluye empaque)", () => {
    expect(parsed.recetas.length).toBeGreaterThan(100);
  });

  it("Humedades > 5 materiales", () => {
    const mats = new Set(parsed.humedades.map(h => h.material_nombre));
    expect(mats.size).toBeGreaterThan(5);
  });

  it("Rotura: ≥ 1 fila", () => {
    expect(parsed.roturas.length).toBeGreaterThan(0);
    expect(parsed.roturas[0].porcentaje).toBeGreaterThan(0);
  });

  it("Ventas: ≥ 5 SKUs distintos", () => {
    const skus = new Set(parsed.ventas.map(v => v.material_nombre));
    expect(skus.size).toBeGreaterThanOrEqual(5);
  });

  it("Rendimientos: incluye Horas Mes y al menos 1 proceso", () => {
    const horasMes = parsed.rendimientos.filter(r => /horas mes/i.test(r.campo));
    expect(horasMes.length).toBeGreaterThan(0);
    const procesos = new Set(parsed.rendimientos.map(r => r.proceso_nombre).filter(Boolean));
    expect(procesos.size).toBeGreaterThan(0);
  });

  it("Indicadores: > 5 conceptos distintos", () => {
    const conceptos = new Set(parsed.indicadores.map(i => i.concepto));
    expect(conceptos.size).toBeGreaterThan(5);
  });

  it("Energía: precio_contrato presente en al menos 1 periodo", () => {
    const contrato = parsed.parametros_energia.filter(e => e.campo === "precio_contrato");
    expect(contrato.length).toBeGreaterThan(0);
    expect(contrato[0].valor).toBeGreaterThan(0);
  });

  it("Energía: precio_restricciones y cargos_fijos presentes", () => {
    const restr = parsed.parametros_energia.filter(e => e.campo === "precio_restricciones");
    const cargos = parsed.parametros_energia.filter(e => e.campo === "cargos_fijos");
    expect(restr.length).toBeGreaterThan(0);
    expect(cargos.length).toBeGreaterThan(0);
  });

  it("Combustibles: ≥ 3 proveedores con PCI", () => {
    const provs = new Set(parsed.combustibles_pci.map(c => c.proveedor));
    expect(provs.size).toBeGreaterThanOrEqual(3);
  });

  it("Energía Térmica: kcal_tck_total presente", () => {
    const kcal = parsed.energia_termica.filter(e => e.campo === "kcal_tck_total");
    expect(kcal.length).toBeGreaterThan(0);
    expect(kcal[0].valor).toBeGreaterThan(1_000_000);
  });

  it("Inventarios: ≥ 1 fila inventario_final", () => {
    const inv = parsed.inventarios.filter(i => i.campo === "inventario_final");
    expect(inv.length).toBeGreaterThan(0);
  });

  it("Recetas Fibrocemento (ORD 16): extrae ≥ 8 líneas con producto_nombre 'Cemento Fibro'", () => {
    const fibroRecetas = parsed.recetas.filter(r =>
      r.producto_nombre?.toLowerCase().includes("fibro")
    );
    expect(fibroRecetas.length).toBeGreaterThanOrEqual(8);
    const materiales = new Set(fibroRecetas.map(r => r.material_nombre?.toLowerCase()));
    expect(materiales).toContain("clinker");
    expect(materiales).toContain("yeso");
    expect(materiales).toContain("puzolana");
  });
});

describe("Importer Excel real — rango configurable por versión", () => {
  it("filtra los períodos a Sep 2025–Ago 2026 (12 meses)", () => {
    const buffer = loadExcelFixture();
    const parsed = parseExcel(buffer, { fechaInicio: "2025-09-01", fechaFin: "2026-08-01" });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.periodos).toHaveLength(12);
    expect(parsed.periodos[0]).toBe("2025-09-01");
    expect(parsed.periodos[parsed.periodos.length - 1]).toBe("2026-08-01");
  });

  it("filtra los períodos a Sep 2025–Dic 2026 (16 meses)", () => {
    const buffer = loadExcelFixture();
    const parsed = parseExcel(buffer, { fechaInicio: "2025-09-01", fechaFin: "2026-12-01" });
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.periodos.length).toBeLessThanOrEqual(16);
    expect(parsed.periodos[0]).toBe("2025-09-01");
  });

  it("advierte cuando la versión pide períodos que el Excel no trae", () => {
    const buffer = loadExcelFixture();
    const parsed = parseExcel(buffer, { fechaInicio: "2025-09-01", fechaFin: "2027-12-01" });
    const warnFaltantes = parsed.warnings.find(w => /espera/i.test(w.mensaje));
    expect(warnFaltantes).toBeDefined();
  });
});
