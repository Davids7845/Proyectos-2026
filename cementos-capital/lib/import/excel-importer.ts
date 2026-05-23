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
// Layout de la hoja "Datos" (Nueva_Plantilla_Ppto_CV_V2.xlsx)
//
// El sheet arranca en B1 (col A vacía). Al pasarlo por sheet_to_json
// los índices quedan así:
//   row[0] = col B = Tipo / Concepto / Material
//   row[1] = col C = UM (unidad)
//   row[2..N] = cols D..S = periodos (16 fechas, sólo usamos los 12 primeros)
//
// Secciones reconocidas (col B exactamente igual, col C vacía):
//   Precios · % Consumo · Recetas · Humedades · Rotura · Ventas ·
//   Rendimiento · Indicadores · Energía · Combustibles ·
//   Energía Térmica · Inventarios
//
// Por ahora parseamos: Precios, % Consumo, Recetas (incluye empaque),
// Humedades. Las otras secciones se ignoran con warning.
// ─────────────────────────────────────────────────────────────────

const SHEET_NAME = "Datos";

const CONCEPTO_COL = 0;          // col B
const UNIDAD_COL = 1;             // col C
const FIRST_PERIOD_COL = 2;       // col D
const MAX_PERIODS = 12;           // 12 meses del presupuesto (Sep2025–Ago2026)

const SECTION_NAMES = new Set([
  "Precios",
  "% Consumo",
  "Recetas",
  "Humedades",
  "Rotura",
  "Ventas",
  "Rendimiento",
  "Indicadores",
  "Energía",
  "Combustibles",
  "Energía Térmica",
  "Inventarios",
]);

// Patrón de receta: "<material> En <producto>"
const RECETA_PATTERN = /^(.+?)\s+En\s+(.+)$/i;
// Patrón de empaque: "Sacos para <producto>"  ó "Cargue clinker a Tolva"
const SACOS_PATTERN = /^Sacos para\s+(.+)$/i;

// ─────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────

function cleanText(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function cellToPeriodo(v: unknown): Periodo | null {
  if (v == null || v === "") return null;
  let d: Date | null = null;
  if (typeof v === "number") {
    const ms = (v - 25569) * 86400 * 1000;
    d = new Date(ms);
  } else if (v instanceof Date) {
    d = v;
  } else {
    const parsed = new Date(String(v).trim());
    if (!isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function cellToNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type Sheet2D = unknown[][];

function getCell(sheet: Sheet2D, row0: number, col0: number): unknown {
  const r = sheet[row0];
  if (!r) return undefined;
  return r[col0];
}

function isSectionHeader(sheet: Sheet2D, row0: number): string | null {
  const concepto = cleanText(getCell(sheet, row0, CONCEPTO_COL));
  if (!concepto || !SECTION_NAMES.has(concepto)) return null;
  const unidad = cleanText(getCell(sheet, row0, UNIDAD_COL));
  if (unidad !== "") return null;
  return concepto;
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

// ─────────────────────────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────────────────────────

export function parseExcel(buffer: ArrayBuffer | Buffer | Uint8Array): ParsedExcel {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];

  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
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

  // ─── Periodos: primera fila con fecha en col D ───
  const periodos: Periodo[] = [];
  let headerRow0 = -1;
  for (let r = 0; r < Math.min(sheet.length, 10); r++) {
    const cand = cellToPeriodo(getCell(sheet, r, FIRST_PERIOD_COL));
    if (cand) {
      headerRow0 = r;
      for (let c = FIRST_PERIOD_COL; c < FIRST_PERIOD_COL + MAX_PERIODS; c++) {
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
      mensaje: "No se detectó fila de cabeceras de periodos (esperado: cols D..O con fechas).",
    });
    return emptyParsed(errors, warnings);
  }
  if (periodos.length < MAX_PERIODS) {
    warnings.push({
      seccion: "general",
      row_excel: headerRow0 + 1,
      mensaje: `Sólo ${periodos.length} periodos detectados (esperados ${MAX_PERIODS}).`,
    });
  }

  // ─── Mapeo de secciones: nombre → [row_inicio_0based, row_fin_0based_excl] ───
  const sections = new Map<string, [number, number]>();
  let currentName: string | null = null;
  let currentStart = -1;
  for (let r = headerRow0 + 1; r < sheet.length; r++) {
    const name = isSectionHeader(sheet, r);
    if (name) {
      if (currentName) sections.set(currentName, [currentStart, r]);
      currentName = name;
      currentStart = r + 1;
    }
  }
  if (currentName) sections.set(currentName, [currentStart, sheet.length]);

  // Confirma secciones esperadas
  for (const sec of ["Precios", "% Consumo", "Recetas", "Humedades"]) {
    if (!sections.has(sec)) {
      warnings.push({ seccion: "general", row_excel: null, mensaje: `Sección "${sec}" no encontrada` });
    }
  }

  // ─── Precios ───
  const precios: PrecioParsed[] = [];
  const precioRange = sections.get("Precios");
  if (precioRange) {
    const [start, end] = precioRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      // Saltar filas derivadas (e.g. "Caliza + Martillo" se calcula en el motor)
      if (/\s\+\s/.test(concepto)) continue;
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, FIRST_PERIOD_COL + i));
        if (v == null) continue;
        precios.push({
          material_nombre: concepto,
          proveedor: null,
          periodo: periodos[i],
          precio: v,
          unidad,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── % Consumo ───
  const porcentajes_consumo: PorcentajeConsumoParsed[] = [];
  const pctRange = sections.get("% Consumo");
  if (pctRange) {
    const [start, end] = pctRange;
    for (let r = start; r < end; r++) {
      const proveedor = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!proveedor || !unidad) continue;
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, FIRST_PERIOD_COL + i));
        if (v == null) continue;
        const pct = v > 1.5 ? v / 100 : v;
        porcentajes_consumo.push({
          material_nombre: proveedor,   // en esta sección la fila es el proveedor; el material se infiere
          proveedor: "default",
          periodo: periodos[i],
          porcentaje: pct,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Recetas (incluye empaque) ───
  const recetas: RecetaLineaParsed[] = [];
  const recetaRange = sections.get("Recetas");
  if (recetaRange) {
    const [start, end] = recetaRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;

      let materialNombre: string | null = null;
      let productoNombre: string | null = null;

      const m = concepto.match(RECETA_PATTERN);
      if (m) {
        materialNombre = cleanText(m[1]);
        productoNombre = cleanText(m[2]);
      } else {
        const s = concepto.match(SACOS_PATTERN);
        if (s) {
          materialNombre = "Sacos";
          productoNombre = cleanText(s[1]);
        } else if (/^cargue/i.test(concepto)) {
          materialNombre = "Cargue";
          productoNombre = "Clinker a Tolva";
        } else {
          warnings.push({
            seccion: "recetas",
            row_excel: r + 1,
            mensaje: `Receta no reconocida: "${concepto}" (esperado patrón "X En Y" o "Sacos para Y")`,
          });
          continue;
        }
      }

      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, FIRST_PERIOD_COL + i));
        if (v == null) continue;
        recetas.push({
          producto_nombre: productoNombre,
          material_nombre: materialNombre,
          periodo: periodos[i],
          porcentaje: v,        // %/Producto ya viene como fracción (0..1); empaque como unidades/Ton
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Humedades ───
  const humedades: HumedadParsed[] = [];
  const humRange = sections.get("Humedades");
  if (humRange) {
    const [start, end] = humRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, FIRST_PERIOD_COL + i));
        if (v == null) continue;
        const pct = v > 1.5 ? v / 100 : v;
        humedades.push({
          material_nombre: concepto,
          periodo: periodos[i],
          porcentaje: pct,
          row_excel: r + 1,
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
