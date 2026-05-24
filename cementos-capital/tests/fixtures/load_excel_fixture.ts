// Helper para cargar el fixture XLSX real (con valores cacheados desde la última
// vez que el archivo se guardó en Excel/LibreOffice) y extraer los valores
// objetivo de la hoja "Costo" que el motor debe reconciliar.
//
// El archivo tests/fixtures/budget_excel_real.xlsx debe regenerarse cuando
// cambien las fuentes; sus celdas tienen los valores numéricos ya resueltos.

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const FIXTURE_PATH = path.resolve(__dirname, "budget_excel_real.xlsx");

export function loadExcelFixture(): Buffer {
  return fs.readFileSync(FIXTURE_PATH);
}

export type PeriodoTipo = "real" | "presupuesto";

export interface TargetValue {
  proceso: string;
  periodoTipo: PeriodoTipo;
  valor: number;
  row_excel: number;
}

/** Filas en la hoja "Costo" donde están los totales por proceso. */
const TARGET_ROWS: Array<{ row: number; proceso: string }> = [
  { row: 14,  proceso: "Trituración" },
  { row: 24,  proceso: "Adiciones" },
  { row: 36,  proceso: "Molienda Crudo" },
  { row: 45,  proceso: "Molienda Carbón" },
  { row: 58,  proceso: "Combustibles Alternos" },
  { row: 74,  proceso: "Clinkerización" },
  { row: 90,  proceso: "Cemento UG (granel)" },
  { row: 106, proceso: "Cemento ART (granel)" },
  { row: 114, proceso: "Empaque UG 50 kg" },
  { row: 122, proceso: "Empaque UG 42,5 kg" },
  { row: 167, proceso: "Fibrocemento" },
];

// Col I (idx 8) = panel "Real Sep-2025"; col P (idx 15) = panel "Presupuesto"
const COL_REAL = "I";
const COL_PRESUPUESTO = "P";

export function extractTargetValues(buffer: Buffer): TargetValue[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: false });
  const sheet = wb.Sheets["Costo"];
  if (!sheet) throw new Error('Hoja "Costo" no encontrada en el fixture');

  const out: TargetValue[] = [];
  for (const { row, proceso } of TARGET_ROWS) {
    const real = sheet[`${COL_REAL}${row}`]?.v;
    const ppto = sheet[`${COL_PRESUPUESTO}${row}`]?.v;
    if (typeof real === "number") {
      out.push({ proceso, periodoTipo: "real", valor: real, row_excel: row });
    }
    if (typeof ppto === "number") {
      out.push({ proceso, periodoTipo: "presupuesto", valor: ppto, row_excel: row });
    }
  }
  return out;
}

/** Devuelve sólo los valores Presupuesto (col P), que es el target principal. */
export function extractPresupuesto(buffer: Buffer): Array<{ proceso: string; valor: number }> {
  return extractTargetValues(buffer)
    .filter(t => t.periodoTipo === "presupuesto")
    .map(t => ({ proceso: t.proceso, valor: t.valor }));
}
