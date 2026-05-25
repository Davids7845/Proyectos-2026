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
};

/** Filas de energía eléctrica (kWh/Ton y precio) por ORD → row absoluto.
 *  Columna N = kWh/Ton Presupuesto, Columna O = precio efectivo COP/kWh.
 */
export const ENERGIA_OVERRIDE_ROWS: Record<number, number> = {
   1:   9,
   3:  33,
   4:  44,
   5:  66,
   6:  85,
   7: 101,
  16: 164,
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
