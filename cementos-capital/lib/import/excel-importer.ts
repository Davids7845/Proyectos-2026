import * as XLSX from "xlsx";
import type {
  ParsedExcel,
  PrecioParsed,
  PorcentajeConsumoParsed,
  RecetaLineaParsed,
  HumedadParsed,
  RoturaParsed,
  VentaParsed,
  RendimientoParsed,
  IndicadorParsed,
  ParametroEnergiaParsed,
  CombustiblePciParsed,
  EnergiaTermicaParsed,
  InventarioParsed,
  CostoFijoParsed,
  EnergiaOverrideParsed,
  MpOverrideParsed,
  ImportError,
  ImportWarning,
  Periodo,
} from "./types";
import {
  COSTOS_FIJOS_CONFIG,
  ENERGIA_OVERRIDE_ROWS,
  CONSUMO_CASCADE_ROWS,
  COSTO_MATERIAL_ROWS,
  COSTO_COL_REAL,
  COSTO_COL_CONSUMO,
  COSTO_COL_PRECIO,
} from "./costo-sheet-config";

// ─────────────────────────────────────────────────────────────────
// Layout de la hoja "Datos" (Nueva_Plantilla_Ppto_CV_V2.xlsx)
//
// El sheet arranca en B1 (col A vacía). Al pasarlo por sheet_to_json
// los índices quedan así:
//   row[0] = col B = Tipo / Concepto / Material
//   row[1] = col C = UM (unidad)
//   row[2..N] = cols D..S = periodos (hasta 24 fechas, se importan las del rango de la versión)
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
const MAX_PERIODS_HARD = 24;      // límite duro de seguridad al leer columnas del header

export interface VersionRange {
  fechaInicio: string; // "YYYY-MM-DD"
  fechaFin: string;    // "YYYY-MM-DD"
}

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
// Extrae tamaño de saco del nombre del producto: "Ug 50 Kg" → "50 Kg", "Art 42,5 Kg" → "42,5 Kg"
const SACO_SIZE_RE = /(\d[\d,]*\s*Kg)\s*$/i;

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
    roturas: [],
    ventas: [],
    rendimientos: [],
    indicadores: [],
    parametros_energia: [],
    combustibles_pci: [],
    energia_termica: [],
    inventarios: [],
    costos_fijos: [],
    energia_overrides: [],
    mp_overrides: [],
    errors,
    warnings,
  };
}

/** Extrae "Proceso" de un texto tipo "Campo (Proceso)" -> "Proceso". */
function extractProcesoFromParens(label: string): { campo: string; proceso: string | null } {
  const m = label.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) return { campo: cleanText(m[1]), proceso: cleanText(m[2]) };
  return { campo: cleanText(label), proceso: null };
}

/** Mapeo de etiqueta cruda en la sección Energía → campo canónico + proceso_key opcional. */
function mapEnergiaLabel(label: string): { campo: ParametroEnergiaParsed["campo"]; proceso_key: string | null } {
  const l = label.toLowerCase();
  if (l.includes("contrato")) return { campo: "precio_contrato", proceso_key: null };
  if (l.includes("conexión") || l.includes("conexion") || l.includes("restriccion")) return { campo: "precio_restricciones", proceso_key: null };
  if (l.includes("cargos fijos") || l.includes("admin")) return { campo: "cargos_fijos", proceso_key: null };
  if (l.includes("energía elécrica") || l.includes("energía eléctrica") || l.includes("energia electrica")) return { campo: "precio_energia_total", proceso_key: null };
  if (l.includes("smarten")) return { campo: "facturacion_smarten", proceso_key: null };

  // "Consumo Eléctrico <Proceso>" → kwh_ton_proceso con proceso_key normalizado
  const m = label.match(/^Consumo\s+El[eé]ctrico\s+(.+)$/i);
  if (m) {
    const proc = cleanText(m[1]).toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
    // Aliases para alinear con nombres de proceso en BD
    const aliases: Record<string, string> = {
      "crudo": "molienda de crudo",
      "carbon": "molienda de carbón",
      "carbón": "molienda de carbón",
      "alternos": "combustibles alternos",
      "horno": "clinkerización",
      "cemento ug": "cemento ug",
      "cemento art": "cemento art",
      "cemento fibro": "fibrocemento",
    };
    const proceso_key = aliases[proc] ?? proc;
    return { campo: "kwh_ton_proceso", proceso_key };
  }
  return { campo: "otros", proceso_key: null };
}

/** Mapeo de etiqueta de Inventarios → campo canónico. */
function mapInventarioLabel(label: string): { campo: InventarioParsed["campo"]; material: string } {
  const m = label.match(/^(Consumos|Ventas|Inventario Final)\s+(.+)$/i);
  if (!m) return { campo: "otro", material: label };
  const tipo = m[1].toLowerCase();
  const campo: InventarioParsed["campo"] =
    tipo === "consumos" ? "consumos" :
    tipo === "ventas" ? "ventas" :
    "inventario_final";
  return { campo, material: cleanText(m[2]) };
}

/** Energía térmica: "Diesel Seco", "Carbón Mixto Seco (Masa)", etc. */
function mapEnergiaTermicaLabel(label: string): { campo: EnergiaTermicaParsed["campo"]; componente: string | null } {
  const l = label.toLowerCase();
  if (l.includes("energía total horno") || l.includes("energia total horno") || l.startsWith("kcal")) {
    return { campo: "kcal_tck_total", componente: null };
  }
  if (l.includes("(masa)") || l.includes("(volumen)")) {
    return { campo: "composicion", componente: cleanText(label) };
  }
  if (l.includes("seco") && !l.includes("(masa)")) {
    return { campo: "pci_seco", componente: cleanText(label) };
  }
  if (l.includes("humedad")) {
    return { campo: "humedad_combustible", componente: cleanText(label) };
  }
  return { campo: "otro", componente: cleanText(label) };
}

// ─────────────────────────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────────────────────────

/**
 * Lista esperada de períodos para un rango [fechaInicio, fechaFin], como "YYYY-MM-01".
 */
export function periodosDeRango(range: VersionRange): Periodo[] {
  const out: Periodo[] = [];
  const start = new Date(`${range.fechaInicio}T00:00:00Z`);
  const end   = new Date(`${range.fechaFin}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last   = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   1));
  while (cursor <= last) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}-01`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export function parseExcel(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  versionRange?: VersionRange,
): ParsedExcel {
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
  // Leemos TODOS los períodos disponibles en el header (hasta MAX_PERIODS_HARD) y
  // guardamos también el offset de columna de cada uno; así, si la versión define un
  // rango, podemos mapear cada período retenido a su columna original sin desordenar.
  const periodosAll: Array<{ periodo: Periodo; col: number }> = [];
  let headerRow0 = -1;
  for (let r = 0; r < Math.min(sheet.length, 10); r++) {
    const cand = cellToPeriodo(getCell(sheet, r, FIRST_PERIOD_COL));
    if (cand) {
      headerRow0 = r;
      for (let c = FIRST_PERIOD_COL; c < FIRST_PERIOD_COL + MAX_PERIODS_HARD; c++) {
        const p = cellToPeriodo(getCell(sheet, r, c));
        if (p) periodosAll.push({ periodo: p, col: c });
        else break;
      }
      break;
    }
  }

  if (headerRow0 < 0 || periodosAll.length === 0) {
    errors.push({
      seccion: "general",
      row_excel: null,
      mensaje: "No se detectó fila de cabeceras de periodos (esperado: cols D..S con fechas).",
    });
    return emptyParsed(errors, warnings);
  }

  // Si la versión define un rango, filtramos a los meses dentro del rango.
  // Si no, conservamos todos los períodos detectados (comportamiento legacy).
  let periodosFiltrados = periodosAll;
  if (versionRange) {
    const rangoEsperado = new Set(periodosDeRango(versionRange));
    periodosFiltrados = periodosAll.filter(p => rangoEsperado.has(p.periodo));

    const detectados = new Set(periodosAll.map(p => p.periodo));
    const faltantes = Array.from(rangoEsperado).filter(p => !detectados.has(p));
    if (faltantes.length > 0) {
      warnings.push({
        seccion: "general",
        row_excel: headerRow0 + 1,
        mensaje: `La versión espera ${rangoEsperado.size} meses pero el Excel sólo trae ${periodosAll.length}. Faltan: ${faltantes.join(", ")}`,
      });
    }
    const sobrantes = periodosAll.length - periodosFiltrados.length;
    if (sobrantes > 0) {
      warnings.push({
        seccion: "general",
        row_excel: headerRow0 + 1,
        mensaje: `Se ignoraron ${sobrantes} períodos del Excel que están fuera del rango de la versión.`,
      });
    }
  }

  // Listado plano y mapeo período → columna (preserva el orden cronológico del header).
  const periodos: Periodo[] = periodosFiltrados.map(p => p.periodo);
  const periodCols: number[] = periodosFiltrados.map(p => p.col);

  if (periodos.length === 0) {
    errors.push({
      seccion: "general",
      row_excel: headerRow0 + 1,
      mensaje: "Ningún período del Excel cae dentro del rango de la versión.",
    });
    return emptyParsed(errors, warnings);
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
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
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
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
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
          productoNombre = cleanText(s[1]);
          const sizeMatch = productoNombre.match(SACO_SIZE_RE);
          materialNombre = sizeMatch ? `Sacos ${sizeMatch[1]}` : "Sacos";
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
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
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
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
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

  // ─── Rotura ───
  const roturas: RoturaParsed[] = [];
  const rotRange = sections.get("Rotura");
  if (rotRange) {
    const [start, end] = rotRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        const pct = v > 1.5 ? v / 100 : v;
        roturas.push({
          material_nombre: concepto,
          periodo: periodos[i],
          porcentaje: pct,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Ventas ───
  const ventas: VentaParsed[] = [];
  const ventasRange = sections.get("Ventas");
  if (ventasRange) {
    const [start, end] = ventasRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        ventas.push({
          material_nombre: concepto,
          periodo: periodos[i],
          cantidad_ton: v,
          unidad,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Rendimiento ───
  const rendimientos: RendimientoParsed[] = [];
  const rendRange = sections.get("Rendimiento");
  if (rendRange) {
    const [start, end] = rendRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      const { campo, proceso } = extractProcesoFromParens(concepto);
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        rendimientos.push({
          campo,
          proceso_nombre: proceso,
          periodo: periodos[i],
          valor: v,
          unidad,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Indicadores ───
  const indicadores: IndicadorParsed[] = [];
  const indRange = sections.get("Indicadores");
  if (indRange) {
    const [start, end] = indRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      const { campo, proceso } = extractProcesoFromParens(concepto);
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        // Normalizar porcentajes (disponibilidad, OEE, utilización) que vienen 0..1 ó 0..100
        const isPct = unidad === "%" || /disponibilidad|oee|utilizaci/i.test(campo);
        const valor = isPct && v > 1.5 ? v / 100 : v;
        indicadores.push({
          concepto: campo,
          proceso_nombre: proceso,
          periodo: periodos[i],
          valor,
          unidad,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Energía ───
  const parametros_energia: ParametroEnergiaParsed[] = [];
  const enerRange = sections.get("Energía");
  if (enerRange) {
    const [start, end] = enerRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      const { campo, proceso_key } = mapEnergiaLabel(concepto);
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        parametros_energia.push({
          campo,
          proceso_key,
          periodo: periodos[i],
          valor: v,
          unidad,
          row_excel: r + 1,
          raw_label: concepto,
        });
      }
    }
  }

  // ─── Combustibles ───
  const combustibles_pci: CombustiblePciParsed[] = [];
  const combRange = sections.get("Combustibles");
  if (combRange) {
    const [start, end] = combRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      // Patrón "<Proveedor> (PCI)" — extraer proveedor
      const m = concepto.match(/^(.+?)\s*\(PCI\)\s*$/i);
      const proveedor = m ? cleanText(m[1]) : concepto;
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        combustibles_pci.push({
          proveedor,
          periodo: periodos[i],
          pci: v,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Energía Térmica ───
  const energia_termica: EnergiaTermicaParsed[] = [];
  const termRange = sections.get("Energía Térmica");
  if (termRange) {
    const [start, end] = termRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      const { campo, componente } = mapEnergiaTermicaLabel(concepto);
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        // Normalizar % de composición
        const isPctComp = campo === "composicion" && unidad === "%" && v > 1.5;
        const valor = isPctComp ? v / 100 : v;
        energia_termica.push({
          campo,
          componente,
          periodo: periodos[i],
          valor,
          unidad,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Inventarios ───
  const inventarios: InventarioParsed[] = [];
  const invRange = sections.get("Inventarios");
  if (invRange) {
    const [start, end] = invRange;
    for (let r = start; r < end; r++) {
      const concepto = cleanText(getCell(sheet, r, CONCEPTO_COL));
      const unidad = cleanText(getCell(sheet, r, UNIDAD_COL));
      if (!concepto || !unidad) continue;
      const { campo, material } = mapInventarioLabel(concepto);
      for (let i = 0; i < periodos.length; i++) {
        const v = cellToNumber(getCell(sheet, r, periodCols[i]));
        if (v == null) continue;
        inventarios.push({
          material_nombre: material,
          campo,
          periodo: periodos[i],
          cantidad_ton: v,
          row_excel: r + 1,
        });
      }
    }
  }

  // ─── Hoja "Costo": costos fijos + overrides de energía y MP ───
  let costos_fijos: CostoFijoParsed[] = [];
  let energia_overrides: EnergiaOverrideParsed[] = [];
  let mp_overrides: MpOverrideParsed[] = [];
  const costoSheetName = wb.SheetNames.find(n => n.toLowerCase() === "costo");
  if (costoSheetName && periodos.length > 0) {
    const periodoPpto = derivePeriodoPpto(periodos);
    const cs = wb.Sheets[costoSheetName] as Record<string, { v?: unknown }>;
    const parsed = parseCostoSheetCells(cs, periodoPpto, periodos);
    costos_fijos = parsed.costos_fijos;
    energia_overrides = parsed.energia_overrides;
    mp_overrides = parsed.mp_overrides;
  }

  return {
    periodos,
    precios,
    porcentajes_consumo,
    recetas,
    humedades,
    roturas,
    ventas,
    rendimientos,
    indicadores,
    parametros_energia,
    combustibles_pci,
    energia_termica,
    inventarios,
    costos_fijos,
    energia_overrides,
    mp_overrides,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────
// Helpers para hoja "Costo"
// ─────────────────────────────────────────────────────────────────

/** Deriva el periodo presupuesto (año max, enero) del array de periodos del Datos. */
function derivePeriodoPpto(periodos: Periodo[]): Periodo {
  const years = periodos.map(p => Number(p.slice(0, 4)));
  const maxY = Math.max(...years);
  return `${maxY}-01-01`;
}

type CostoSheet = Record<string, { v?: unknown }>;

function getCostoCell(cs: CostoSheet, col: string, row: number): unknown {
  return cs[`${col}${row}`]?.v ?? null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseCostoSheetCells(
  cs: CostoSheet,
  periodoPpto: Periodo,
  periodos: Periodo[] = [],
): { costos_fijos: CostoFijoParsed[]; energia_overrides: EnergiaOverrideParsed[]; mp_overrides: MpOverrideParsed[] } {
  const costos_fijos: CostoFijoParsed[] = [];
  const energia_overrides: EnergiaOverrideParsed[] = [];
  const mp_overrides: MpOverrideParsed[] = [];

  // Costos fijos (col I = "Total" Real = costo_por_ton): la tasa COP/Ton aplica
  // a todos los periodos. NOTA: se usa la columna I (Real), no la P (Presupuesto):
  // la columna P contiene la versión presupuesto (p.ej. Barras=477 COP/Ton) que
  // NO corresponde a los costos fijos efectivos del modelo (Barras=903 COP/Ton).
  const periodsForFijos = periodos.length > 0 ? periodos : [periodoPpto];
  for (const [ordStr, items] of Object.entries(COSTOS_FIJOS_CONFIG)) {
    const ord = Number(ordStr);
    for (const it of items) {
      const v = toNum(getCostoCell(cs, COSTO_COL_REAL, it.row));
      if (v != null) {
        for (const periodo of periodsForFijos) {
          costos_fijos.push({ ord, codigo: it.codigo, nombre: it.nombre, periodo, costo_por_ton: v, row_excel: it.row });
        }
      }
    }
  }

  // Overrides de energía (col N = kWh/Ton, col O = precio efectivo)
  for (const [ordStr, row] of Object.entries(ENERGIA_OVERRIDE_ROWS)) {
    const ord = Number(ordStr);
    const kwh = toNum(getCostoCell(cs, COSTO_COL_CONSUMO, row));
    const precio = toNum(getCostoCell(cs, COSTO_COL_PRECIO, row));
    if (kwh != null && precio != null) {
      energia_overrides.push({ ord, periodo: periodoPpto, kwh_ton: kwh, precio_efectivo: precio, row_excel: row });
    }
  }

  // Overrides consumo cascada (ORD 5: CARBONMOL, COMBALT)
  for (const { ord, material_codigo, row } of CONSUMO_CASCADE_ROWS) {
    const consumo = toNum(getCostoCell(cs, COSTO_COL_CONSUMO, row));
    if (consumo != null) {
      mp_overrides.push({ ord, material_codigo, periodo: periodoPpto, consumo_ton_ton: consumo, precio_cop_ton: null, row_excel: row });
    }
  }

  // Overrides MP receta (consumo N + precio O)
  for (const [ordStr, items] of Object.entries(COSTO_MATERIAL_ROWS)) {
    const ord = Number(ordStr);
    for (const { row, material_codigo } of items) {
      const consumo = toNum(getCostoCell(cs, COSTO_COL_CONSUMO, row));
      const precio = toNum(getCostoCell(cs, COSTO_COL_PRECIO, row));
      if (consumo != null || precio != null) {
        mp_overrides.push({ ord, material_codigo, periodo: periodoPpto, consumo_ton_ton: consumo, precio_cop_ton: precio, row_excel: row });
      }
    }
  }

  return { costos_fijos, energia_overrides, mp_overrides };
}
