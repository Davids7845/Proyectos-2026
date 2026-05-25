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

// ─── Nuevas secciones Fase 1.5 ────────────────────────────────────────────────

export interface RoturaParsed {
  material_nombre: string;        // típicamente "Sacos"
  periodo: Periodo;
  porcentaje: number;
  row_excel: number;
}

export interface VentaParsed {
  material_nombre: string;        // "Ug 50 Kg", "Granel Art", etc.
  periodo: Periodo;
  cantidad_ton: number;
  unidad: string;
  row_excel: number;
}

/**
 * Rendimientos viene como pares "Campo (Proceso)". Almacenamos cada fila como
 * un par campo+procesoNombre+valor, y el loader agrupa por (proceso, periodo).
 */
export interface RendimientoParsed {
  campo: string;                  // "horas_mes", "produccion_ton", etc.
  proceso_nombre: string | null;  // ej: "Cemento Total", "Ug", "Trituración", o null si es global
  periodo: Periodo;
  valor: number;
  unidad: string;
  row_excel: number;
}

export interface IndicadorParsed {
  concepto: string;               // texto crudo
  proceso_nombre: string | null;
  periodo: Periodo;
  valor: number;
  unidad: string;
  row_excel: number;
}

export interface ParametroEnergiaParsed {
  campo:
    | "precio_contrato"
    | "precio_restricciones"
    | "cargos_fijos"
    | "precio_energia_total"
    | "facturacion_smarten"
    | "kwh_ton_proceso"
    | "otros";
  /** Solo válido si campo === "kwh_ton_proceso": clave normalizada del proceso */
  proceso_key?: string | null;
  periodo: Periodo;
  valor: number;
  unidad: string;
  row_excel: number;
  raw_label: string;              // por trazabilidad
}

export interface CombustiblePciParsed {
  proveedor: string;              // ej: "Sanoha", "Forero Hernandez"
  periodo: Periodo;
  pci: number;                    // Kcal/Ton
  row_excel: number;
}

export interface EnergiaTermicaParsed {
  campo: "kcal_tck_total" | "composicion" | "pci_seco" | "humedad_combustible" | "otro";
  componente: string | null;      // p.ej "Diesel Seco", "Carbón Mixto Seco (Masa)"
  periodo: Periodo;
  valor: number;
  unidad: string;
  row_excel: number;
}

export interface InventarioParsed {
  material_nombre: string;        // "Cemento Ug", "Cemento Art", etc.
  campo: "consumos" | "ventas" | "inventario_final" | "otro";
  periodo: Periodo;
  cantidad_ton: number;
  row_excel: number;
}

// ─── Tipos de la hoja "Costo" (Fase 1.7 / Fase 2) ────────────────────────────

/** Costo fijo extraído de la hoja Costo (repuestos, servicios, regalías). */
export interface CostoFijoParsed {
  ord:           number;   // número de proceso (ORD)
  codigo:        string;   // clave estable, ej "BARRAS_PLAC_TRIT"
  nombre:        string;   // etiqueta humana del Excel
  periodo:       Periodo;
  costo_por_ton: number;   // COP/Ton
  row_excel:     number;
}

/** Override de energía eléctrica (kWh/Ton + precio efectivo) para un proceso. */
export interface EnergiaOverrideParsed {
  ord:             number;
  periodo:         Periodo;
  kwh_ton:         number;
  precio_efectivo: number;  // COP/kWh
  row_excel:       number;
}

/** Override de consumo (Ton/Ton) y/o precio (COP/Ton) de un material en un proceso. */
export interface MpOverrideParsed {
  ord:             number;
  material_codigo: string;
  periodo:         Periodo;
  consumo_ton_ton: number | null;
  precio_cop_ton:  number | null;
  row_excel:       number;
}

// ─── Errores / Warnings ───────────────────────────────────────────────────────

export type SeccionImporter =
  | "precios"
  | "porcentajes_consumo"
  | "recetas"
  | "humedades"
  | "rotura"
  | "ventas"
  | "rendimiento"
  | "indicadores"
  | "energia"
  | "combustibles"
  | "energia_termica"
  | "inventarios"
  | "costos_fijos"
  | "energia_overrides"
  | "mp_overrides";

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
  periodos: Periodo[];
  precios: PrecioParsed[];
  porcentajes_consumo: PorcentajeConsumoParsed[];
  recetas: RecetaLineaParsed[];
  humedades: HumedadParsed[];
  // Fase 1.5
  roturas: RoturaParsed[];
  ventas: VentaParsed[];
  rendimientos: RendimientoParsed[];
  indicadores: IndicadorParsed[];
  parametros_energia: ParametroEnergiaParsed[];
  combustibles_pci: CombustiblePciParsed[];
  energia_termica: EnergiaTermicaParsed[];
  inventarios: InventarioParsed[];
  // Fase 1.7: hoja "Costo"
  costos_fijos: CostoFijoParsed[];
  energia_overrides: EnergiaOverrideParsed[];
  mp_overrides: MpOverrideParsed[];
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface LoadReport {
  precios_insertados: number;
  porcentajes_insertados: number;
  recetas_creadas: number;
  receta_lineas_insertadas: number;
  humedades_insertadas: number;
  // Fase 1.5
  roturas_insertadas: number;
  ventas_insertadas: number;
  rendimientos_insertados: number;
  parametros_energia_insertados: number;
  inventarios_insertados: number;
  // Fase 1.7
  costos_fijos_insertados: number;
  energia_overrides_insertados: number;
  mp_overrides_insertados: number;
  materiales_no_encontrados: string[];
  procesos_no_encontrados: string[];
  errores: ImportError[];
}
