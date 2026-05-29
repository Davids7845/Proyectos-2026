import { describe, it, expect } from "vitest";
import { clasificarComponente } from "@/lib/calc/procesos/_componentes_proceso";

describe("clasificarComponente (Fase 3)", () => {
  it("clasifica regalías", () => {
    expect(clasificarComponente("Regalías")).toBe("regalia");
    expect(clasificarComponente("Regalías Caliza", "REGALIAS_CALIZA")).toBe("regalia");
  });

  it("clasifica combustibles auxiliares (gasoil/diesel)", () => {
    expect(clasificarComponente("Gasoil")).toBe("combustible_aux");
    expect(clasificarComponente("Gasoil (Fibrocemento)", "GASOIL_FIB")).toBe("combustible_aux");
  });

  it("clasifica servicios (cargue, descargue, dosificación, empaque)", () => {
    expect(clasificarComponente("Cargue Clinker")).toBe("servicio");
    expect(clasificarComponente("Descargue Finos Carbón")).toBe("servicio");
    expect(clasificarComponente("Dosificación Sal")).toBe("servicio");
    expect(clasificarComponente("Cargador Carbón")).toBe("servicio");
  });

  it("clasifica repuestos (barras, placas, cuerpos moledores, láminas, dique, desmantelamiento)", () => {
    expect(clasificarComponente("Barras y Placas")).toBe("repuesto");
    expect(clasificarComponente("Material Dique")).toBe("repuesto");
    expect(clasificarComponente("Cuerpos Moledores (Crudo)")).toBe("repuesto");
    expect(clasificarComponente("Láminas (Crudo)")).toBe("repuesto");
    expect(clasificarComponente("Anillos, Tapas y Separadores (Crudo)")).toBe("repuesto");
    expect(clasificarComponente("Desmantelamiento")).toBe("repuesto");
    expect(clasificarComponente("Variables")).toBe("repuesto");
  });

  it("clasifica fletes", () => {
    expect(clasificarComponente("Flete Carbón (Boyacá-Planta)", "FLETE_CARB_BOY")).toBe("flete");
  });

  it("default a 'fijo' para no reconocidos", () => {
    expect(clasificarComponente("Algo Raro Sin Categoría")).toBe("fijo");
  });
});
