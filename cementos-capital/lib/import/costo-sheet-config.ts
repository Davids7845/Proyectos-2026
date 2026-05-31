// Configuración compartida para leer la hoja "Costo" del Excel presupuesto.
// Usada tanto por el importer de producción como por el fixture de tests.
//
// Estructura de columnas en hoja "Costo":
//   I  = periodo Real       (2025-09-01 en la plantilla actual)
//   N  = consumo Presupuesto (Ton/Ton o kWh/Ton según fila)
//   O  = precio  Presupuesto (COP/Ton o COP/kWh según fila)
//   P  = costo total Presupuesto (COP/Ton)

export const COSTO_COL_REAL    = "I";
export const COSTO_COL_CONSUMO = "N";
export const COSTO_COL_PRECIO  = "O";
export const COSTO_COL_PPTO    = "P";

/** Costos fijos por proceso (repuestos, servicios, regalías, consumibles).
 *  row  = número de fila absoluto en hoja Costo (1-based).
 *  Se extraen de la columna P (Presupuesto) y columna I (Real).
 */
export const COSTOS_FIJOS_CONFIG: Record<
  number,
  Array<{ row: number; codigo: string; nombre: string }>
> = {
  1: [
    { row: 10, codigo: "BARRAS_PLAC_TRIT", nombre: "Barras y Placas" },
    { row: 11, codigo: "MAT_DIQUE",        nombre: "Material Dique" },
    { row: 12, codigo: "DESMANT_TRIT",     nombre: "Desmantelamiento" },
    { row: 13, codigo: "REGALIAS",         nombre: "Regalías" },
  ],
  2: [
    { row: 20, codigo: "BARRAS_PLAC_AD",  nombre: "Barras y Placas" },
    { row: 21, codigo: "MAT_DIQUE_AD",    nombre: "Material Dique" },
    { row: 22, codigo: "DESMANT_AD",      nombre: "Desmantelamiento" },
    { row: 23, codigo: "REGALIAS_AD",     nombre: "Regalías" },
  ],
  3: [
    { row: 30, codigo: "CUERPOS_MOL_CR",   nombre: "Cuerpos Moledores (Crudo)" },
    { row: 31, codigo: "LAMINAS_CR",       nombre: "Láminas (Crudo)" },
    { row: 32, codigo: "ANILLOS_TAPAS_CR", nombre: "Anillos, Tapas y Separadores (Crudo)" },
  ],
  4: [
    { row: 41, codigo: "DESCARGUE_FINOS_C", nombre: "Descargue Finos Carbón" },
    { row: 42, codigo: "CARGADOR_CARBON",   nombre: "Cargador Carbón" },
    { row: 43, codigo: "CUERPOS_MOL_C",     nombre: "Cuerpos Moledores y Láminas" },
  ],
  5: [
    { row: 65, codigo: "DUCTOS_CK",        nombre: "Ductos" },
    { row: 67, codigo: "CARGUE_CK",        nombre: "Cargue Clinker" },
    { row: 68, codigo: "SELLADO_CK",       nombre: "Sellado" },
    { row: 69, codigo: "ENFRIADOR_CK",     nombre: "Enfriador" },
    { row: 70, codigo: "CARGUE_CK_TOLVA",  nombre: "Cargue Ck Tolva" },
    { row: 71, codigo: "GASOIL_CK",        nombre: "Gasoil" },
    { row: 72, codigo: "PLACAS_CK",        nombre: "Placas" },
    { row: 73, codigo: "REFRACTARIOS_CK",  nombre: "Refractarios" },
  ],
  6: [
    { row: 83, codigo: "CUERPOS_MOL_UG",   nombre: "Cuerpos Moledores (Cemento UG)" },
    { row: 84, codigo: "PLACAS_SEG_UG",    nombre: "Placas y Segmentos (Cemento UG)" },
  ],
  7: [
    { row: 99,  codigo: "CUERPOS_MOL_ART", nombre: "Cuerpos Moledores (Cemento ART)" },
    { row: 100, codigo: "PLACAS_SEG_ART",  nombre: "Placas y Segmentos (Cemento ART)" },
  ],
  16: [
    { row: 162, codigo: "CUERPOS_MOL_FIB", nombre: "Cuerpos Moledores (Fibrocemento)" },
    { row: 163, codigo: "PLACAS_SEG_FIB",  nombre: "Placas y Segmentos (Fibrocemento)" },
    { row: 165, codigo: "GASOIL_FIB",      nombre: "Gasoil (Fibrocemento)" },
  ],
  20: [
    { row: 54, codigo: "CARGUE_ALT",    nombre: "Cargue" },
    { row: 55, codigo: "DESCARGUE_ALT", nombre: "Descargue" },
    { row: 56, codigo: "VARIABLES_ALT", nombre: "Variables" },
  ],
};

/** Filas de energía eléctrica (kWh/Ton y precio) por ORD → row absoluto.
 *  Columna N = kWh/Ton Presupuesto, Columna O = precio efectivo COP/kWh.
 *
 *  ORD 1 (Trituración) se omite deliberadamente: su energía se calcula
 *  siempre desde parametros_energia (kwh_ton_proceso["trituracion"] × precio
 *  contrato/restricciones), no desde un override del Excel Presupuesto.
 *  Las cols N/O del bloque ORD1 contienen valores Presupuesto (1.2926 kWh/Ton
 *  @ 485 COP/kWh) que difieren del modelo real y NO deben importarse.
 */
export const ENERGIA_OVERRIDE_ROWS: Record<number, number> = {
   2:  19,
   3:  33,
   4:  44,
   5:  66,
   6:  85,
   7: 101,
  16: 164,
  20:  57,
};

/** Overrides de consumo (cascada) de materiales específicos para ORD 5. */
export const CONSUMO_CASCADE_ROWS: Array<{
  ord: number;
  material_codigo: string;
  row: number;
}> = [
  { ord: 5, material_codigo: "CARBONMOL", row: 63 },
  { ord: 5, material_codigo: "COMBALT",   row: 64 },
];

/** Overrides de consumo (col N) y precio (col O) para materiales de receta
 *  donde el Excel Presupuesto difiere del modelo Datos.
 */
export const COSTO_MATERIAL_ROWS: Record<
  number,
  Array<{ row: number; material_codigo: string }>
> = {
  6: [
    { row: 78, material_codigo: "CLINKER001" },
    { row: 79, material_codigo: "CALIZATRI" },
    { row: 80, material_codigo: "ADIT_MOL" },
    { row: 81, material_codigo: "PUZOLANA" },
    { row: 82, material_codigo: "FINOS_FILT" },
    { row: 89, material_codigo: "YESO00001" },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Mapeo completo proceso × material para reconstruir tablas reales.
// Cada entrada apunta a una fila concreta del bloque del proceso en
// la hoja "Costo" del Excel. Se usa para importar costos reales.
// ─────────────────────────────────────────────────────────────────
export const COSTO_MATERIAL_ROWS_FULL: Record<
  number,
  Array<{ row: number; material_codigo: string }>
> = {
  // ORD 1: Trituración
  1: [
    { row: 7, material_codigo: "ARCTLVTRIT" },
    { row: 8, material_codigo: "CALTLVTRIT" },
  ],
  // ORD 2: Adiciones (caliza para adiciones)
  2: [
    { row: 18, material_codigo: "CALTLVTRIT" },
  ],
  // ORD 3: Molienda de Crudo (semielab Prehomo + caliza + mineral hierro)
  3: [
    { row: 28, material_codigo: "MEZCPREHO" },
    { row: 29, material_codigo: "CALTLVTRIT" },
    { row: 35, material_codigo: "CORRHIERR" },
  ],
  // ORD 4: Molienda de Carbón
  4: [
    { row: 40, material_codigo: "CARBITUMI" },
  ],
  // ORD 5: Clinkerización (semielab Harina + Carbón Molido + COMBALT)
  5: [
    { row: 62, material_codigo: "HARINACRUD" },
    { row: 63, material_codigo: "CARBONMOL" },
    { row: 64, material_codigo: "COMBALT" },
  ],
  // ORD 6: Cemento UG
  6: [
    { row: 78, material_codigo: "CLINKER001" },
    { row: 79, material_codigo: "CALIZATRI" },
    { row: 80, material_codigo: "ADIT_MOL" },
    { row: 81, material_codigo: "PUZOLANA" },
    { row: 82, material_codigo: "FINOS_FILT" },
    { row: 89, material_codigo: "YESO00001" },
  ],
  // ORD 7: Cemento ART
  7: [
    { row: 94,  material_codigo: "CLINKER001" },
    { row: 95,  material_codigo: "CALIZATRI" },
    { row: 96,  material_codigo: "ADIT_MOL" },
    { row: 97,  material_codigo: "PUZOLANA" },
    { row: 98,  material_codigo: "FINOS_FILT" },
    { row: 105, material_codigo: "YESO00001" },
  ],
  // ORD 8: Empaque UG 50 kg
  8: [
    { row: 110, material_codigo: "CEM_UG" },
    { row: 113, material_codigo: "SACO_50KG" },
  ],
  // ORD 9: Empaque UG 42,5 kg
  9: [
    { row: 118, material_codigo: "CEM_UG" },
    { row: 121, material_codigo: "SACO_42_5KG" },
  ],
  // ORD 10: Empaque UG 25 kg
  10: [
    { row: 126, material_codigo: "CEM_UG" },
    { row: 129, material_codigo: "SACO_25KG" },
  ],
  // ORD 11: Empaque ART 42,5 kg
  11: [
    { row: 134, material_codigo: "CEM_ART" },
    { row: 137, material_codigo: "SACO_42_5KG" },
  ],
  // ORD 14: Empaque Topex 50 kg
  14: [
    { row: 142, material_codigo: "CEM_TOPEX" },
    { row: 145, material_codigo: "SACO_50KG" },
  ],
  // ORD 16: Fibrocemento
  16: [
    { row: 159, material_codigo: "CLINKER001" },
    { row: 160, material_codigo: "CALIZATRI" },
    { row: 161, material_codigo: "FINOS_FILT" },
    { row: 166, material_codigo: "YESO00001" },
  ],
  // ORD 20: Combustibles Alternos
  20: [
    { row: 49, material_codigo: "CDR" },
    { row: 50, material_codigo: "TDF" },
    { row: 53, material_codigo: "BRIQUETAS" },
  ],
};
