// Parser de costos reales desde un Excel con estructura espejo a la
// hoja "Costo" del archivo presupuesto. Lee un panel (configurable por
// columnas) y produce filas listas para insertar en `costos_reales`.
//
// Layout asumido (panel "Real"): cada bloque de proceso tiene
//   <Tipo> <Consumo> <Precio> <Total>
// en columnas consecutivas. Los rows están fijos según
// COSTO_MATERIAL_ROWS_FULL, COSTOS_FIJOS_CONFIG y ENERGIA_OVERRIDE_ROWS.
//
// Una sola hoja Excel puede contener UN período (mes/año). Para varios
// meses se invoca el parser una vez por upload con el `periodo` distinto.

import * as XLSX from "xlsx";
import {
  COSTO_MATERIAL_ROWS_FULL,
  COSTOS_FIJOS_CONFIG,
  ENERGIA_OVERRIDE_ROWS,
} from "./costo-sheet-config";

export interface CostoRealParsed {
  proceso_ord: number;
  row_excel: number;
  concepto_tipo: "material" | "energia" | "fijo";
  concepto_codigo: string;          // material_codigo, código fijo, o 'ENERGIA'
  consumo: number | null;
  precio_unitario: number | null;
  valor_monetario: number;          // total (col Total) del panel real
  unidad: string | null;
}

export interface CostosRealesParseResult {
  filas: CostoRealParsed[];
  warnings: string[];
}

export interface ParseOptions {
  /** Nombre de la hoja a leer (default "Costo"). */
  sheetName?: string;
  /** Columnas del panel a leer (default = panel derecho/REAL: N/O/P). */
  colConsumo?: string;
  colPrecio?: string;
  colTotal?: string;
  /** Si true, incluye filas con valor_monetario = 0 (default false). */
  includeZeros?: boolean;
}

// Defaults: panel derecho (cols N=Consumo, O=Precio, P=Total) — mismo
// layout que ya usa el importer existente para la columna PPTO.
const DEFAULT_COL_CONSUMO = "N";
const DEFAULT_COL_PRECIO  = "O";
const DEFAULT_COL_TOTAL   = "P";

function readNumber(sheet: XLSX.WorkSheet, addr: string): number | null {
  const c = sheet[addr];
  if (!c) return null;
  if (typeof c.v === "number") return c.v;
  if (typeof c.v === "string") {
    const n = parseFloat(c.v.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  }
  return null;
}

function readRow(
  sheet: XLSX.WorkSheet,
  row: number,
  cols: { consumo: string; precio: string; total: string }
): { consumo: number | null; precio: number | null; total: number } | null {
  const total = readNumber(sheet, `${cols.total}${row}`);
  if (total == null) return null;
  return {
    consumo: readNumber(sheet, `${cols.consumo}${row}`),
    precio:  readNumber(sheet, `${cols.precio}${row}`),
    total,
  };
}

export function parseCostosReales(
  buffer: Buffer,
  opts: ParseOptions = {}
): CostosRealesParseResult {
  const sheetName = opts.sheetName ?? "Costo";
  const cols = {
    consumo: opts.colConsumo ?? DEFAULT_COL_CONSUMO,
    precio:  opts.colPrecio  ?? DEFAULT_COL_PRECIO,
    total:   opts.colTotal   ?? DEFAULT_COL_TOTAL,
  };
  const includeZeros = opts.includeZeros ?? false;

  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: false });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);

  const filas: CostoRealParsed[] = [];
  const warnings: string[] = [];

  const pushIfPresent = (
    ord: number,
    row: number,
    concepto_tipo: CostoRealParsed["concepto_tipo"],
    concepto_codigo: string,
    unidad: string | null
  ) => {
    const data = readRow(sheet, row, cols);
    if (!data) return;
    if (!includeZeros && data.total === 0) return;
    filas.push({
      proceso_ord: ord,
      row_excel: row,
      concepto_tipo,
      concepto_codigo,
      consumo: data.consumo,
      precio_unitario: data.precio,
      valor_monetario: data.total,
      unidad,
    });
  };

  // Materiales por proceso
  for (const [ordStr, rows] of Object.entries(COSTO_MATERIAL_ROWS_FULL)) {
    const ord = Number(ordStr);
    for (const { row, material_codigo } of rows) {
      pushIfPresent(ord, row, "material", material_codigo, "T");
    }
  }

  // Energía eléctrica por proceso
  for (const [ordStr, row] of Object.entries(ENERGIA_OVERRIDE_ROWS)) {
    const ord = Number(ordStr);
    pushIfPresent(ord, row, "energia", "ENERGIA", "kWh");
  }

  // Costos fijos (repuestos, regalías, servicios) por proceso
  for (const [ordStr, rows] of Object.entries(COSTOS_FIJOS_CONFIG)) {
    const ord = Number(ordStr);
    for (const { row, codigo } of rows) {
      pushIfPresent(ord, row, "fijo", codigo, null);
    }
  }

  if (filas.length === 0) {
    warnings.push(
      `No se extrajo ninguna fila del panel ${cols.consumo}/${cols.precio}/${cols.total}; ` +
      `verifica que las columnas correspondan al panel REAL de la hoja "${sheetName}".`
    );
  }

  return { filas, warnings };
}
