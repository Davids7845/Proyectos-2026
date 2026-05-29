// Composiciones de materiales agregados extraídas de las fórmulas del Excel
// (hoja Datos, sección Precios). Cada entrada define los materiales componentes
// de un material agregado con sus porcentajes y orden de visualización.
//
// Formato: material_destino_codigo → [[material_origen_codigo, porcentaje, orden], ...]
// porcentaje: fracción 0..1 (puede no sumar 1.0 si hay componentes con 0%)

export const MATERIAL_AGREGADOS_SEED: Record<string, Array<[string, number, number]>> = {
  // ── CARBONES ──────────────────────────────────────────────────────────────
  // Carbón Fino = mezcla Sanoha + Forero Hernandez
  "CARB_FINO": [
    ["CARBON_SANOHA",    0.50, 1],
    ["CARBON_FORERO_HZ", 0.50, 2],
  ],
  // Carbón Mixto = mezcla Tottal + Soluciones + Margaritas
  "CARB_MIXTO": [
    ["CARBON_TOTTAL",      0.43, 1],
    ["CARBON_SOL_COL",     0.36, 2],
    ["CARBON_MARGARITAS",  0.21, 3],
  ],
  // Carbón Bituminoso = mezcla de varios proveedores
  "CARBITUMI": [
    ["INTERAMER_CONMINA",  0.30, 1],
    ["CARBON_TRANCORA",    0.30, 2],
    ["CARBON_ANDINO",      0.05, 3],
    ["CARBON_CARBOCOQUE",  0.17, 4],
    ["CARBON_COQUECOL",    0.18, 5],
  ],

  // ── CDR ───────────────────────────────────────────────────────────────────
  "CDR": [
    ["CDR_FOCUS_GREEN_ANT", 0.50, 1],
    ["CDR_SIST_VERDE_CUN",  0.05, 2],
    ["CDR_SIST_VERDE_ANT",  0.12, 3],
    ["CDR_ECOLOGISTICA",    0.15, 4],
    ["CDR_ECOPOSITIVA",     0.02, 5],
    ["CDR_VEOLIA",          0.01, 6],
    ["CDR_GDI_CALI",        0.15, 7],
    ["CDR_GDI_ZIPAQUIRA",   0.00, 8],
  ],

  // ── TDF ───────────────────────────────────────────────────────────────────
  "TDF": [
    ["TDF_SIST_VERDE_CUN", 0.30, 1],
    ["TDF_SIST_VERDE_ANT", 0.30, 2],
    ["TDF_FOCUS_GREEN_CUN",0.40, 3],
  ],

  // ── MINERAL DE HIERRO ─────────────────────────────────────────────────────
  "CORRHIERR": [
    ["CALAM_GERDAU_DIACO", 0.00, 1],
    ["CALAM_SIDOC",         0.70, 2],
    ["EXIROS_ATLANTICO",    0.30, 3],
  ],

  // ── CALAMINA ─────────────────────────────────────────────────────────────
  "CALAMINA": [
    ["ADPR_BRICENO",    0.30, 1],
    ["ADPR_BELENCITO",  0.60, 2],
    ["TAP_PAYANDE",     0.10, 3],
    ["EXIRO_MANIZALES", 0.00, 4],
  ],

  // ── MEZCLA PONDERADO ─────────────────────────────────────────────────────
  "MEZCLA_PONDERADO": [
    ["BRIQUETAS_ARCLAD", 0.70, 1],
    ["BIOCHIPS_BIOWATT", 0.30, 2],
  ],
};
