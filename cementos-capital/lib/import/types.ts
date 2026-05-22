// Tipos del importador Excel (hoja "Datos" de Nueva_Plantilla_Ppto_CV_V2.xlsx)

export type Periodo = string; // YYYY-MM-01

export interface PrecioParsed {
  material_nombre: string;        // texto crudo de la celda B (limpiado)
  proveedor: string | null;
  periodo: Periodo;
  precio: number;
  unidad: string;
  row_excel: number;              // 1-based, para diagnósticos
}

export interface PorcentajeConsumoParsed {
  material_nombre: string;
  proveedor: string;
  periodo: Periodo;
  porcentaje: number;             // fracción 0..1
  row_excel: number;
}

export interface RecetaLineaParsed {
  producto_nombre: string;        // ej: "Prehomo", "Crudo", "Clinker"
  material_nombre: string;
  periodo: Periodo;
  porcentaje: number;
  row_excel: number;
}

export interface HumedadParsed {
  material_nombre: string;
  periodo: Periodo;
  porcentaje: number;
  row_excel: number;
}

export type SeccionImporter =
  | "precios"
  | "porcentajes_consumo"
  | "recetas"
  | "humedades";

export interface ImportError {
  seccion: SeccionImporter | "general";
  row_excel: number | null;
  mensaje: string;
}

export interface ImportWarning {
  seccion: SeccionImporter | "general";
  row_excel: number | null;
  mensaje: string;
}

export interface ParsedExcel {
  periodos: Periodo[];            // periodos detectados (orden columnas)
  precios: PrecioParsed[];
  porcentajes_consumo: PorcentajeConsumoParsed[];
  recetas: RecetaLineaParsed[];
  humedades: HumedadParsed[];
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface LoadReport {
  precios_insertados: number;
  porcentajes_insertados: number;
  recetas_creadas: number;
  receta_lineas_insertadas: number;
  humedades_insertadas: number;
  materiales_no_encontrados: string[];
  errores: ImportError[];
}
