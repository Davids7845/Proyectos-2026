import * as XLSX from "xlsx";
import type {
  ParsedExcel,
  PrecioParsed,
  PorcentajeConsumoParsed,
  RecetaLineaParsed,
  HumedadParsed,
  ImportError,
  ImportWarning,
  Periodo,
} from "./types";

// ─────────────────────────────────────────────────────────────────
// Configuración: estructura de la hoja "Datos"
// ─────────────────────────────────────────────────────────────────

const SHEET_NAME = "Datos";

// Columna donde inician los periodos (D = idx 3 en 0-based)
// Las primeras 3 columnas son: A=ORD?, B=Concepto, C=Unidad/Proveedor
const FIRST_PERIOD_COL_IDX = 3;

// Sólo usamos los primeros 12 periodos (Sep-2025 a Ago-2026); ignoramos el 13.°
const MAX_PERIODS = 12;

// Filas del Excel con precios de insumos clave (1-based, según análisis previo).
// Si la plantilla cambia, ajustar aquí.
const FILAS_PRECIOS_CONOCIDAS: Array<{
  row: number;
  material: string;
  unidad: string;
  proveedor?: string | null;
}> = [
  // Row 3 es CALCULADA (caliza + martillo ponderado) → no se importa
  { row: 4,  material: "Caliza Explotada",   unidad: "COP/Ton" },
  { row: 6,  material: "Costo Adicional Martillo", unidad: "COP/Ton" },
  { row: 7,  material: "Arcilla Explotada",  unidad: "COP/Ton" },
  // Las siguientes filas son orientativas — el parser usa el texto de la celda B como ground truth
];

// Inicio de la sección "% Consumo" (rows ~128–135 según análisis previo)
const SECCION_PCT_CONSUMO_INICIO = 128;
const SECCION_PCT_CONSUMO_FIN = 140;

// Inicio de la sección "Recetas" / Humedades (orientativo, se detecta por keyword en col B)
const KEYWORDS_RECETA = ["receta", "consumo "];
const KEYWORDS_HUMEDAD = ["humedad"];

// ─────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────

/** Limpia texto: strip + colapsa espacios + remueve tab inicial. */
function cleanText(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/** Convierte serial Excel o ISO a "YYYY-MM-01". null si no parsea. */
function cellToPeriodo(v: unknown): Periodo | null {
  if (v == null || v === "") return null;
  let d: Date | null = null;
  if (typeof v === "number") {
    // serial Excel: 1900-based, días desde 1899-12-30
    const ms = (v - 25569) * 86400 * 1000;
    d = new Date(ms);
  } else if (v instanceof Date) {
    d = v;
  } else {
    const s = String(v).trim();
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

/** Convierte a number; null si vacío/no numérico. */
function cellToNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Lee celda (0-based row, 0-based col) de un sheet a array-of-arrays. */
type Sheet2D = unknown[][];
function getCell(sheet: Sheet2D, row0: number, col0: number): unknown {
  const r = sheet[row0];
  if (!r) return undefined;
  return r[col0];
}

// ─────────────────────────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────────────────────────

export function parseExcel(buffer: ArrayBuffer | Buffer | Uint8Array): ParsedExcel {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase() === SHEET_NAME.toLowerCase());
  if (!sheetName) {
    errors.push({
      seccion: "general",
      row_excel: null,
      mensaje: `No se encontró la hoja "${SHEET_NAME}". Hojas disponibles: ${wb.SheetNames.join(", ")}`,
    });
    return emptyParsed(errors, warnings);
  }

  const sheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
  }) as Sheet2D;

  // Fila de cabeceras de periodos: en el Excel suele ser fila 1 o 2.
  // Buscamos la primera fila que tenga una fecha en col D.
  const periodos: Periodo[] = [];
  let headerRow0 = -1;
  for (let r = 0; r < Math.min(sheet.length, 10); r++) {
    const cand = cellToPeriodo(getCell(sheet, r, FIRST_PERIOD_COL_IDX));
    if (cand) {
      headerRow0 = r;
      for (let c = FIRST_PERIOD_COL_IDX; c < FIRST_PERIOD_COL_IDX + MAX_PERIODS; c++) {
        const p = cellToPeriodo(getCell(sheet, r, c));
        if (p) periodos.push(p);
        else break;
      }
      break;
    }
  }

  if (headerRow0 < 0 || periodos.length === 0) {
    errors.push({
      seccion: "general",
      row_excel: null,
      mensaje: "No se detectó fila de cabeceras de periodos (columnas D..O esperadas con fechas).",
    });
    return emptyParsed(errors, warnings);
  }
  if (periodos.length < MAX_PERIODS) {
    warnings.push({
      seccion: "general",
      row_excel: headerRow0 + 1,
      mensaje: `Se detectaron ${periodos.length} periodos (esperados ${MAX_PERIODS}).`,
    });
  }

  // ──────────────── Precios ────────────────
  const precios: PrecioParsed[] = [];
  for (const def of FILAS_PRECIOS_CONOCIDAS) {
    const r0 = def.row - 1;
    const conceptoCelda = cleanText(getCell(sheet, r0, 1));
    if (!conceptoCelda) {
      warnings.push({
        seccion: "precios",
        row_excel: def.row,
        mensaje: `Fila ${def.row} vacía en col B (esperado: "${def.material}")`,
      });
      continue;
    }
    for (let i = 0; i < periodos.length; i++) {
      const valor = cellToNumber(getCell(sheet, r0, FIRST_PERIOD_COL_IDX + i));
      if (valor == null) continue;
      precios.push({
        material_nombre: conceptoCelda,
        proveedor: def.proveedor ?? null,
        periodo: periodos[i],
        precio: valor,
        unidad: def.unidad,
        row_excel: def.row,
      });
    }
  }

  // Barrido genérico: filas entre la header y la sección %Consumo.
  // Detecta cualquier fila con texto en col B y valores numéricos en columnas de periodo.
  const inicioBarrido = headerRow0 + 1;
  const finBarrido = SECCION_PCT_CONSUMO_INICIO - 1;
  const filasYaCapturadas = new Set(FILAS_PRECIOS_CONOCIDAS.map(f => f.row));

  for (let r0 = inicioBarrido; r0 < Math.min(sheet.length, finBarrido); r0++) {
    if (filasYaCapturadas.has(r0 + 1)) continue;
    const concepto = cleanText(getCell(sheet, r0, 1));
    if (!concepto) continue;
    // Si la fila parece un encabezado/sección (todo mayúsculas largas sin números), ignorar.
    const tieneNumeros = periodos.some((_, i) =>
      cellToNumber(getCell(sheet, r0, FIRST_PERIOD_COL_IDX + i)) != null
    );
    if (!tieneNumeros) continue;
    // Saltar filas reservadas a porcentajes/recetas detectadas más abajo.
    const lower = concepto.toLowerCase();
    if (KEYWORDS_RECETA.some(k => lower.includes(k))) continue;
    if (KEYWORDS_HUMEDAD.some(k => lower.includes(k))) continue;
    // Heurística: filas de precios suelen tener "explotada", "costo", "energía", "precio" en el nombre.
    // Aceptamos cualquiera con valores numéricos en col D..O — el usuario puede limpiar al final.
    for (let i = 0; i < periodos.length; i++) {
      const valor = cellToNumber(getCell(sheet, r0, FIRST_PERIOD_COL_IDX + i));
      if (valor == null) continue;
      precios.push({
        material_nombre: concepto,
        proveedor: null,
        periodo: periodos[i],
        precio: valor,
        unidad: "COP/Ton",
        row_excel: r0 + 1,
      });
    }
  }

  // ──────────────── % Consumo ────────────────
  const porcentajes_consumo: PorcentajeConsumoParsed[] = [];
  for (let r0 = SECCION_PCT_CONSUMO_INICIO - 1; r0 < Math.min(sheet.length, SECCION_PCT_CONSUMO_FIN); r0++) {
    const concepto = cleanText(getCell(sheet, r0, 1));
    const proveedor = cleanText(getCell(sheet, r0, 2)) || "default";
    if (!concepto) continue;
    for (let i = 0; i < periodos.length; i++) {
      const v = cellToNumber(getCell(sheet, r0, FIRST_PERIOD_COL_IDX + i));
      if (v == null) continue;
      // Normalizar a fracción si viene como porcentaje
      const pct = v > 1.5 ? v / 100 : v;
      porcentajes_consumo.push({
        material_nombre: concepto,
        proveedor,
        periodo: periodos[i],
        porcentaje: pct,
        row_excel: r0 + 1,
      });
    }
  }

  // ──────────────── Recetas / Humedades ────────────────
  // Por ahora detectamos por keyword en col B después de la sección de % Consumo.
  const recetas: RecetaLineaParsed[] = [];
  const humedades: HumedadParsed[] = [];
  let productoActual: string | null = null;

  for (let r0 = SECCION_PCT_CONSUMO_FIN; r0 < sheet.length; r0++) {
    const concepto = cleanText(getCell(sheet, r0, 1));
    if (!concepto) continue;
    const lower = concepto.toLowerCase();

    if (KEYWORDS_RECETA.some(k => lower.includes(k))) {
      // Línea tipo "Receta Prehomo" → marca producto
      const match = concepto.match(/receta\s+(.+)/i);
      productoActual = match ? cleanText(match[1]) : concepto;
      continue;
    }

    if (KEYWORDS_HUMEDAD.some(k => lower.includes(k))) {
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r0, FIRST_PERIOD_COL_IDX + i));
        if (v == null) continue;
        humedades.push({
          material_nombre: concepto.replace(/humedad/i, "").trim(),
          periodo: periodos[i],
          porcentaje: v > 1.5 ? v / 100 : v,
          row_excel: r0 + 1,
        });
      }
      continue;
    }

    // Si estamos en una receta y la fila tiene números → línea de receta
    if (productoActual) {
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r0, FIRST_PERIOD_COL_IDX + i));
        if (v == null) continue;
        recetas.push({
          producto_nombre: productoActual,
          material_nombre: concepto,
          periodo: periodos[i],
          porcentaje: v > 1.5 ? v / 100 : v,
          row_excel: r0 + 1,
        });
      }
    }
  }

  return {
    periodos,
    precios,
    porcentajes_consumo,
    recetas,
    humedades,
    errors,
    warnings,
  };
}

function emptyParsed(errors: ImportError[], warnings: ImportWarning[]): ParsedExcel {
  return {
    periodos: [],
    precios: [],
    porcentajes_consumo: [],
    recetas: [],
    humedades: [],
    errors,
    warnings,
  };
}
