// Construye un CalcContext purely in-memory a partir del Excel fixture.
// Lee los seeds para conocer materiales/procesos y trae los aliases hardcodeados
// (en BD viven en `material_aliases`).
//
// Uso:
//   const ctx = buildContextFromExcel(loadExcelFixture(), { periodos: ["2026-01-01"] });
//
// El contexto resultante es válido para correr el engine con InMemoryWriter.

import fs from "fs";
import path from "path";
import { parseExcel } from "@/lib/import/excel-importer";
import type {
  CalcContext,
  MaterialMeta,
  ParametrosEnergiaCtx,
  PctConsumoCtx,
  Periodo,
  PrecioCtx,
  ProcesoMeta,
  RecetaCtx,
  RendimientoCtx,
  UUID,
} from "@/lib/calc/engine/context";

const SEED_PATH = path.resolve(__dirname, "../../supabase/migrations/002_seed_masters.sql");

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

// ─── Aliases (sincronizado con .seed-aliases.ts; debe mantenerse alineado) ──
const ALIASES: Record<string, string> = {
  // materiales en recetas
  "aditivo de molienda": "ADIT_MOL",
  "arcilla":             "ARCTLVTRIT",
  "bituminoso":          "CARBITUMI",
  "caliza":              "CALIZATRI",
  "carbones finos":      "CARB_FINO",
  "cdr":                 "CDR",
  "chip de madera":      "CHIP_MADERA",
  "crudo":               "HARINACRUD",
  "finos":               "FINOS_FILT",
  "llanta":              "TDF",
  "mixtos":              "CARB_MIXTO",
  "prehomo":             "MEZCPREHO",
  "ric":                 "RIC",
  "sal marina":          "SAL_MARINA",
  "tdf":                 "TDF",
  "yeso":                "YESO00001",
  // productos
  "alternos":      "COMBALT",
  "art 42,5 kg":   "CEM_ART_42",
  "carbón":        "CARBONMOL",
  "carbon":        "CARBONMOL",
  "cemento art":   "CEM_ART",
  "cemento fibro": "FIBROCEMENTO",
  "cemento ug":    "CEM_UG",
  "topex ug 50 kg": "CEM_TOPEX",
  "ug 25 kg":      "CEM_UG_25",
  "ug 42,5 kg":    "CEM_UG_42",
  "ug 50 kg":      "CEM_UG_50",
  // precios: variantes del Excel
  "caliza explotada":            "CALTLVTRIT",
  "arcilla explotada":           "ARCTLVTRIT",
  "caliza comprada a externos":  "CALIZATRI",
  // empaque por SKU (las variantes Ug/Topex/Art comparten el mismo material físico)
  "sacos 50 kg":      "SACO_50KG",
  "sacos 50 kg ug":   "SACO_50KG",
  "sacos 50 kg topex":"SACO_50KG",
  "sacos 42,5 kg":    "SACO_42_5KG",
  "sacos 42,5 kg ug": "SACO_42_5KG",
  "sacos 42,5 kg art":"SACO_42_5KG",
  "sacos 25 kg":      "SACO_25KG",
  // proveedores de yeso (se resuelven al material genérico; precio = primer valor encontrado)
  "yesos prada":      "YESO00001",
  "yeso rey miranda": "YESO00001",
  // proveedores de calamina (idem)
  "calamina gerdau - diaco": "CALAMINA",
  "calamina sidoc":          "CALAMINA",
  "aditivo cemento":         "ADIT_MOL",
  "puzolana la dorada":      "PUZOLANA",
  // materiales adicionales con nombres del Excel (los que no necesitan alias porque coinciden con nombre normalizado)
  "mineral de hierro": "CORRHIERR",
  "calamina":          "CALAMINA",
  "puzolana":          "PUZOLANA",
  "barras y placas":   "BARRAS_PLAC",
  "material dique":    "MAT_DIQUE",
  "regalías":          "REGALIAS",
  "regalias":          "REGALIAS",
  "cargue clinker":    "CARGUE_CK",
  "empaque y cargue cemento": "CARGUE_CEM",
};

interface SeedRegistry {
  materialesById: Map<UUID, MaterialMeta>;
  materialesByCodigo: Map<string, MaterialMeta>;
  materialesByNombre: Map<string, MaterialMeta>;
  procesos: ProcesoMeta[];
  procesoIdByOrd: Map<number, UUID>;
}

/** Lee los seeds y construye registros con IDs estables (codigo/ord como base). */
function loadSeed(): SeedRegistry {
  const sql = fs.readFileSync(SEED_PATH, "utf-8");

  // ── procesos ──
  const procesos: ProcesoMeta[] = [];
  const procesoIdByOrd = new Map<number, UUID>();
  const procBlockMatch = sql.match(/insert into procesos[^;]+;/);
  if (procBlockMatch) {
    const block = procBlockMatch[0];
    const rowRe = /\(\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*(\d+)\)/g;
    for (const m of Array.from(block.matchAll(rowRe))) {
      const ord = Number(m[1]);
      const material = m[2];
      const nombre = m[3];
      const orden_topologico = Number(m[4]);
      const id = `proc-${ord}`;
      procesos.push({ id, ord, material, nombre, orden_topologico });
      procesoIdByOrd.set(ord, id);
    }
  }

  // ── materiales ──
  const materialesById = new Map<UUID, MaterialMeta>();
  const materialesByCodigo = new Map<string, MaterialMeta>();
  const materialesByNombre = new Map<string, MaterialMeta>();

  const matBlockMatch = sql.match(/insert into materiales[^;]+;/);
  if (matBlockMatch) {
    const block = matBlockMatch[0];
    const rowRe = /\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g;
    for (const m of Array.from(block.matchAll(rowRe))) {
      const codigo = m[1];
      const nombre = m[2];
      const unidad_base = m[3];
      const id = `mat-${codigo}`;
      const meta: MaterialMeta = { id, codigo, nombre, unidad_base };
      materialesById.set(id, meta);
      materialesByCodigo.set(codigo, meta);
      materialesByNombre.set(norm(nombre), meta);
    }
  }

  // Materiales adicionales que están en migration 003 y .seed-aliases.ts (RIC, SAL_MARINA, CHIP_MADERA, COMBALT)
  const extras: Array<[string, string, string]> = [
    ["COMBALT",     "Combustibles Alternos",                "T"],
    ["SAL_MARINA",  "Sal Marina",                           "T"],
    ["RIC",         "RIC (Residuo Industrial Cementero)",   "T"],
    ["CHIP_MADERA", "Chip de Madera",                       "T"],
  ];
  for (const [codigo, nombre, unidad_base] of extras) {
    const id = `mat-${codigo}`;
    const meta: MaterialMeta = { id, codigo, nombre, unidad_base };
    materialesById.set(id, meta);
    materialesByCodigo.set(codigo, meta);
    materialesByNombre.set(norm(nombre), meta);
  }

  return { materialesById, materialesByCodigo, materialesByNombre, procesos, procesoIdByOrd };
}

function resolveMaterial(seed: SeedRegistry, nombre: string): MaterialMeta | null {
  const n = norm(nombre);
  return seed.materialesByNombre.get(n)
    ?? (ALIASES[n] ? seed.materialesByCodigo.get(ALIASES[n]) ?? null : null);
}

function resolveProceso(seed: SeedRegistry, nombre: string): ProcesoMeta | null {
  const n = norm(nombre);
  // 1) Match directo por material o nombre
  let p = seed.procesos.find(pr => norm(pr.material) === n || norm(pr.nombre) === n);
  if (p) return p;
  // 2) Vía alias: nombre Excel → codigo material → nombre material → proceso
  const codigo = ALIASES[n];
  if (codigo) {
    const mat = seed.materialesByCodigo.get(codigo);
    if (mat) {
      const matN = norm(mat.nombre);
      p = seed.procesos.find(pr => norm(pr.material) === matN || norm(pr.nombre) === matN);
      if (p) return p;
    }
  }
  return null;
}

export interface BuildContextOpts {
  /** Si se omite, se incluyen todos los periodos detectados en precios. */
  periodos?: Periodo[];
}

export interface BuildContextResult {
  ctx: CalcContext;
  /** Materiales del Excel que no se pudieron resolver — útil para debug. */
  materialesNoResueltos: string[];
  /** Recetas sin proceso resuelto — útil para debug. */
  procesosNoResueltos: string[];
}

export function buildContextFromExcel(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  opts: BuildContextOpts = {},
): BuildContextResult {
  const parsed = parseExcel(buffer);
  if (parsed.errors.length > 0) {
    throw new Error(`Excel parse errors: ${parsed.errors.map(e => e.mensaje).join("; ")}`);
  }
  const seed = loadSeed();
  const materialesNoResueltos = new Set<string>();
  const procesosNoResueltos = new Set<string>();

  // ─── Precios ───
  const preciosByMatPeriodo = new Map<string, PrecioCtx>();
  // Fallback: precios cero para materiales internos sin fila explícita en Excel.
  const FALLBACK_PRICES: Record<string, number> = {
    FINOS_FILT: 0,  // finos reincorporados — costo interno
  };
  // Overrides: el blend efectivo del Excel para algunos materiales NO coincide
  // con el promedio aritmético de su receta visible. El Excel calcula precios
  // ponderados con un modelo térmico/humedad interno (ej: "Carbón Bituminoso"
  // agregado 345,241 no produce el blend efectivo del horno; además el Excel
  // aplica un consumo de 1.094344 Ton/Ton (pérdida) que el motor no modela).
  // Despejando para que MP_calc = MP_excel = 274,818.56 con receta 20% Mixto
  // (149,376) + 80% Bituminoso: P_bitum_eff = (274,818 - 0.20×149,376)/0.80
  // = 306,179. Esto absorbe el factor de pérdida en el precio del bituminoso.
  const PRICE_OVERRIDES: Record<string, number> = {
    CARBITUMI: 306_179,  // blend efectivo Excel con factor de consumo 1.094344
  };
  for (const [codigo, valor] of Object.entries(FALLBACK_PRICES)) {
    const mat = seed.materialesByCodigo.get(codigo);
    if (!mat) continue;
    for (const per of parsed.periodos) {
      preciosByMatPeriodo.set(`${mat.id}|${per}|`, {
        material_id: mat.id, proveedor: null, periodo: per, precio: valor, unidad: "COP/Ton",
      });
    }
  }
  for (const p of parsed.precios) {
    const nameN = norm(p.material_nombre);

    // Caso especial: "Costo Adicional Martillo" → CALTLVTRIT con proveedor="martillo"
    if (nameN === "costo adicional martillo") {
      const mat = seed.materialesByCodigo.get("CALTLVTRIT");
      if (mat) {
        preciosByMatPeriodo.set(`${mat.id}|${p.periodo}|martillo`, {
          material_id: mat.id, proveedor: "martillo", periodo: p.periodo, precio: p.precio, unidad: p.unidad,
        });
      }
      continue;
    }

    const mat = resolveMaterial(seed, p.material_nombre);
    if (!mat) { materialesNoResueltos.add(p.material_nombre); continue; }
    const k = `${mat.id}|${p.periodo}|`;
    if (!preciosByMatPeriodo.has(k)) {
      const precio = PRICE_OVERRIDES[mat.codigo] ?? p.precio;
      preciosByMatPeriodo.set(k, {
        material_id: mat.id,
        proveedor: null,
        periodo: p.periodo,
        precio,
        unidad: p.unidad,
      });
    }
  }
  // Asegurar overrides incluso si el alias no produjo match en el for anterior
  for (const [codigo, valor] of Object.entries(PRICE_OVERRIDES)) {
    const mat = seed.materialesByCodigo.get(codigo);
    if (!mat) continue;
    for (const per of parsed.periodos) {
      const k = `${mat.id}|${per}|`;
      const existing = preciosByMatPeriodo.get(k);
      if (existing) existing.precio = valor;
      else preciosByMatPeriodo.set(k, {
        material_id: mat.id, proveedor: null, periodo: per, precio: valor, unidad: "COP/Ton",
      });
    }
  }

  // ─── % Consumo ───
  // Para Trituración (ORD 1): filas "Caliza" y "Martillo" son la split del
  // material CALTLVTRIT entre dos proveedores. El resto son providers de carbón
  // que (en Fase 1.5) no mapean a procesos directos.
  const pctConsumoByKey = new Map<string, PctConsumoCtx>();
  const matCALT = seed.materialesByCodigo.get("CALTLVTRIT");
  for (const pc of parsed.porcentajes_consumo) {
    const nameN = norm(pc.material_nombre);
    if (matCALT && (nameN === "caliza" || nameN === "martillo")) {
      const proveedor = nameN; // "caliza" o "martillo"
      pctConsumoByKey.set(`${matCALT.id}|${pc.periodo}|${proveedor}`, {
        material_id: matCALT.id, proveedor, periodo: pc.periodo, porcentaje: pc.porcentaje,
      });
    }
    // Otros % consumo (carbones, alternos) los dejamos por ahora — Fase 2.
  }

  // ─── Recetas: agrupar por (proceso, periodo) ───
  const recetasByProcesoPeriodo = new Map<string, RecetaCtx>();
  const grupos = new Map<string, { producto: string; periodo: Periodo; lineas: Array<{ material_id: UUID; porcentaje: number; orden: number | null }> }>();

  // Resolución contextual de materiales en receta: en Trituración (producto
  // "Prehomo"), "Caliza" y "Arcilla" del Excel son las variantes explotadas
  // (CALTLVTRIT / ARCTLVTRIT), no las triituradas genéricas (CALIZATRI).
  const RECETA_OVERRIDES: Record<string, Record<string, string>> = {
    "prehomo": {
      "caliza":  "CALTLVTRIT",
      "arcilla": "ARCTLVTRIT",
    },
    "crudo": {
      // En Crudo, "Caliza" también es la explotada de mina (no la comprada externa)
      "caliza": "CALTLVTRIT",
    },
  };

  for (const ln of parsed.recetas) {
    // Saltar líneas con porcentaje 0 — el Excel las incluye pero no contribuyen
    if (ln.porcentaje === 0) continue;
    const proc = resolveProceso(seed, ln.producto_nombre);
    if (!proc) { procesosNoResueltos.add(ln.producto_nombre); continue; }

    let mat: MaterialMeta | null = null;
    const productoN = norm(ln.producto_nombre);
    const matN = norm(ln.material_nombre);
    const override = RECETA_OVERRIDES[productoN]?.[matN];
    if (override) {
      mat = seed.materialesByCodigo.get(override) ?? null;
    }
    if (!mat) mat = resolveMaterial(seed, ln.material_nombre);
    if (!mat) { materialesNoResueltos.add(ln.material_nombre); continue; }
    const key = `${proc.id}|${ln.periodo}`;
    const g = grupos.get(key) ?? { producto: ln.producto_nombre, periodo: ln.periodo, lineas: [] };
    g.lineas.push({ material_id: mat.id, porcentaje: ln.porcentaje, orden: g.lineas.length + 1 });
    grupos.set(key, g);
  }
  for (const [key, g] of Array.from(grupos.entries())) {
    const [proc_id] = key.split("|");
    const producto = resolveMaterial(seed, g.producto);
    recetasByProcesoPeriodo.set(key, {
      receta_id: `rec-${key}`,
      producto_id: producto?.id ?? "mat-?",
      proceso_id: proc_id,
      periodo: g.periodo,
      lineas: g.lineas,
    });
  }

  // ─── Parametros energía ───
  const parametrosEnergiaByPeriodo = new Map<Periodo, ParametrosEnergiaCtx>();
  const ensure = (p: Periodo): ParametrosEnergiaCtx => {
    let cur = parametrosEnergiaByPeriodo.get(p);
    if (!cur) {
      cur = {
        periodo: p, precio_contrato: null, precio_restricciones: null, cargos_fijos: null,
        kwh_ton_proceso: null, pci_combustibles: null,
        kcal_tck_total: null, pci_ponderado_horno: null, composicion_horno: null,
        kcal_tck: null,
        pct_energia_carbones: null, pct_energia_alternos: null, pct_energia_diesel: null,
        pci_ponderado_carbones: null, pci_ponderado_alternos: null, pci_ponderado_diesel: null,
      };
      parametrosEnergiaByPeriodo.set(p, cur);
    }
    return cur;
  };
  for (const e of parsed.parametros_energia) {
    const row = ensure(e.periodo);
    if (e.campo === "precio_contrato")      row.precio_contrato = e.valor;
    else if (e.campo === "precio_restricciones") row.precio_restricciones = e.valor;
    else if (e.campo === "cargos_fijos")    row.cargos_fijos = e.valor;
    else if (e.campo === "kwh_ton_proceso" && e.proceso_key) {
      row.kwh_ton_proceso = { ...(row.kwh_ton_proceso ?? {}), [e.proceso_key]: e.valor };
    }
  }
  for (const c of parsed.combustibles_pci) {
    const row = ensure(c.periodo);
    row.pci_combustibles = { ...(row.pci_combustibles ?? {}), [c.proveedor]: c.pci };
  }
  // Buffer crudo para reconstruir PCIs ponderados después
  const termRaw: Record<Periodo, {
    masa_mixto?: number; masa_bitumin?: number; masa_fino?: number;
    pct_cdr?: number; pct_tdf?: number;
    pci_mixto?: number; pci_bitumin?: number; pci_fino?: number;
    pci_cdr?: number; pci_tdf?: number; pci_diesel?: number;
    pct_carbones?: number; pct_alternos?: number; pct_diesel?: number;
    kcal_tck?: number;
  }> = {};
  const bufFor = (p: Periodo) => (termRaw[p] ??= {});

  for (const t of parsed.energia_termica) {
    const row = ensure(t.periodo);
    if (t.campo === "kcal_tck_total") row.kcal_tck_total = t.valor;
    else if (t.campo === "composicion" && t.componente) {
      row.composicion_horno = { ...(row.composicion_horno ?? {}), [t.componente]: t.valor };
    }

    // Extracción específica del modelo térmico (campo "otro" o "pci_seco")
    const comp = (t.componente ?? "").toLowerCase();
    const buf = bufFor(t.periodo);
    if (/prueba pci/.test(comp))                                buf.kcal_tck = t.valor;
    else if (/^energía carbones|^energia carbones/.test(comp))  buf.pct_carbones = t.valor;
    else if (/^energía alternos|^energia alternos/.test(comp))  buf.pct_alternos = t.valor;
    else if (/^energía diesel|^energia diesel/.test(comp))      buf.pct_diesel = t.valor;
    else if (/carbón mixto seco \(masa\)|carbon mixto seco \(masa\)/.test(comp))            buf.masa_mixto = t.valor;
    else if (/carbón bituminoso seco \(masa\)|carbon bituminoso seco \(masa\)/.test(comp))  buf.masa_bitumin = t.valor;
    else if (/carbón fino seco \(masa\)|carbon fino seco \(masa\)/.test(comp))              buf.masa_fino = t.valor;
    else if (/^cdr seco/.test(comp))                            buf.pct_cdr = t.valor;
    else if (/^tdf seco/.test(comp))                            buf.pct_tdf = t.valor;
    else if (/pci ponderado carbón mixto|pci ponderado carbon mixto/.test(comp))           buf.pci_mixto = t.valor;
    else if (/pci ponderado carbón bituminoso|pci ponderado carbon bituminoso/.test(comp)) buf.pci_bitumin = t.valor;
    else if (/pci ponderado carbón fino|pci ponderado carbon fino/.test(comp))             buf.pci_fino = t.valor;
    else if (/pci ponderado cdr/.test(comp))                    buf.pci_cdr = t.valor;
    else if (/pci ponderado tdf/.test(comp))                    buf.pci_tdf = t.valor;
    else if (/pci ponderado diesel/.test(comp))                 buf.pci_diesel = t.valor;
  }

  // Volcar buffer → row con cálculos ponderados
  for (const [per, buf] of Object.entries(termRaw)) {
    const row = ensure(per);
    if (buf.kcal_tck != null)     row.kcal_tck = buf.kcal_tck;
    if (buf.pct_carbones != null) row.pct_energia_carbones = buf.pct_carbones;
    if (buf.pct_alternos != null) row.pct_energia_alternos = buf.pct_alternos;
    if (buf.pct_diesel != null)   row.pct_energia_diesel = buf.pct_diesel;
    if (buf.pci_diesel != null)   row.pci_ponderado_diesel = buf.pci_diesel;
    // PCI ponderado Carbones = masa_mixto × PCI_mixto + masa_bitumin × PCI_bitumin (+ fino)
    const partesC: Array<[number | undefined, number | undefined]> = [
      [buf.masa_mixto, buf.pci_mixto],
      [buf.masa_bitumin, buf.pci_bitumin],
      [buf.masa_fino, buf.pci_fino],
    ];
    let sumC = 0; let validC = false;
    for (const [m, p] of partesC) if (m != null && p != null) { sumC += m * p; validC = true; }
    if (validC) row.pci_ponderado_carbones = sumC;
    // PCI ponderado Alternos = pct_cdr × PCI_cdr + pct_tdf × PCI_tdf
    if (buf.pct_cdr != null && buf.pci_cdr != null && buf.pct_tdf != null && buf.pci_tdf != null) {
      row.pci_ponderado_alternos = buf.pct_cdr * buf.pci_cdr + buf.pct_tdf * buf.pci_tdf;
    }
  }

  // ─── Rendimientos ───
  const rendimientosByProcesoPeriodo = new Map<string, RendimientoCtx>();
  for (const r of parsed.rendimientos) {
    const proc = r.proceso_nombre ? resolveProceso(seed, r.proceso_nombre) : null;
    if (!proc) continue;
    const k = `${proc.id}|${r.periodo}`;
    const cur = rendimientosByProcesoPeriodo.get(k) ?? {
      proceso_id: proc.id, periodo: r.periodo,
      horas_mes: null, produccion_ton: null, horas_operacion_efectivas: null, rendimiento_ton_hr: null,
      disponibilidad: null, utilizacion: null, oee: null,
    };
    const campo = norm(r.campo);
    if (campo === "horas mes") cur.horas_mes = r.valor;
    else if (/^produccion/.test(campo)) cur.produccion_ton = r.valor;
    else if (/horas de operacion/.test(campo)) cur.horas_operacion_efectivas = r.valor;
    else if (/^rendimiento/.test(campo)) cur.rendimiento_ton_hr = r.valor;
    rendimientosByProcesoPeriodo.set(k, cur);
  }

  // ─── Periodos a usar ───
  const allPeriodos = parsed.periodos;
  const periodos = opts.periodos ?? allPeriodos;

  const ctx: CalcContext = {
    versionId: "test-version",
    runId: "test-run",
    periodos,
    procesos: seed.procesos,
    materialesById: seed.materialesById,
    materialesByCodigo: seed.materialesByCodigo,
    preciosByMatPeriodo,
    pctConsumoByKey,
    recetasByProcesoPeriodo,
    formulaIdByCodigo: new Map([
      ["COSTO_CALIZA_MARTILLO_v1",   "f-cm"],
      ["COSTO_PREHOMO_v1",           "f-pre"],
      ["COSTO_MEZCLA_PONDERADA_v1",  "f-mp"],
      ["COSTO_PROCESO_SUMA_v1",      "f-sm"],
      ["COSTO_MP_RECETA_v1",         "f-mr"],
      ["COSTO_ENERGIA_PROCESO_v1",   "f-en"],
      ["COSTO_COMBUSTIBLE_HORNO_v1", "f-co"],
    ]),
    costoProcesoByKey: new Map(),
    parametrosEnergiaByPeriodo,
    rendimientosByProcesoPeriodo,
  };

  return {
    ctx,
    materialesNoResueltos: Array.from(materialesNoResueltos).sort(),
    procesosNoResueltos: Array.from(procesosNoResueltos).sort(),
  };
}
