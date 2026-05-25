/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ParsedExcel, LoadReport } from "./types";

type Client = SupabaseClient<Database>;

/** Normaliza nombre de material para matching contra tabla `materiales`. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface MaterialIdx {
  byNombre: Map<string, string>;     // nombre normalizado → id
  byCodigo: Map<string, string>;     // código exacto → id
  byAlias: Map<string, string>;      // alias normalizado → id
}

async function loadMaterialesIndex(supabase: Client): Promise<MaterialIdx> {
  const { data, error } = await supabase
    .from("materiales")
    .select("id, codigo, nombre")
    .eq("activo", true);
  if (error) throw new Error(`materiales: ${error.message}`);
  const byNombre = new Map<string, string>();
  const byCodigo = new Map<string, string>();
  for (const m of data ?? []) {
    byNombre.set(norm(m.nombre), m.id);
    byCodigo.set(m.codigo, m.id);
  }
  const { data: aliasRows } = await supabase
    .from("material_aliases")
    .select("alias, material_id");
  const byAlias = new Map<string, string>();
  for (const a of aliasRows ?? []) byAlias.set(norm(a.alias), a.material_id);
  return { byNombre, byCodigo, byAlias };
}

function resolveMaterial(idx: MaterialIdx, nombre: string): string | null {
  const n = norm(nombre);
  return idx.byNombre.get(n) ?? idx.byAlias.get(n) ?? null;
}

export async function loadParsedExcel(
  supabase: Client,
  versionId: string,
  parsed: ParsedExcel
): Promise<LoadReport> {
  const report: LoadReport = {
    precios_insertados: 0,
    porcentajes_insertados: 0,
    recetas_creadas: 0,
    receta_lineas_insertadas: 0,
    humedades_insertadas: 0,
    roturas_insertadas: 0,
    ventas_insertadas: 0,
    rendimientos_insertados: 0,
    parametros_energia_insertados: 0,
    inventarios_insertados: 0,
    costos_fijos_insertados: 0,
    energia_overrides_insertados: 0,
    mp_overrides_insertados: 0,
    materiales_no_encontrados: [],
    procesos_no_encontrados: [],
    errores: [...parsed.errors],
  };

  const idx = await loadMaterialesIndex(supabase);
  const noEncontrados = new Set<string>();
  const procesosNoEncontrados = new Set<string>();

  // ──────────────── Precios ────────────────
  // Casos especiales idénticos al fixture build_context_from_excel.ts:
  // "Costo Adicional Martillo" → CALTLVTRIT con proveedor="martillo"
  const PRECIOS_ESPECIALES: Record<string, { codigo: string; proveedor: string }> = {
    "costo adicional martillo": { codigo: "CALTLVTRIT", proveedor: "martillo" },
  };

  const preciosRows = parsed.precios
    .map(p => {
      const nombreNorm = norm(p.material_nombre);
      const especial = PRECIOS_ESPECIALES[nombreNorm];
      if (especial) {
        const materialId = idx.byCodigo.get(especial.codigo);
        if (!materialId) return null;
        return {
          version_id: versionId,
          material_id: materialId,
          proveedor: especial.proveedor,
          periodo: p.periodo,
          precio_unitario: Number(p.precio),
          unidad: p.unidad,
          moneda: "COP",
        };
      }
      const materialId = resolveMaterial(idx, p.material_nombre);
      if (!materialId) {
        noEncontrados.add(p.material_nombre);
        return null;
      }
      return {
        version_id: versionId,
        material_id: materialId,
        proveedor: p.proveedor,
        periodo: p.periodo,
        precio_unitario: Number(p.precio),
        unidad: p.unidad,
        moneda: "COP",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (preciosRows.length > 0) {
    // Dedup: varios nombres Excel pueden mapear al mismo material_id.
    // Cuando (material_id, proveedor, periodo) se repite, conservamos el último valor.
    const preciosDedup = new Map<string, typeof preciosRows[number]>();
    for (const row of preciosRows) {
      const k = `${row.material_id}|${row.proveedor ?? ""}|${row.periodo}`;
      preciosDedup.set(k, row);
    }
    const preciosToInsert = Array.from(preciosDedup.values());

    const { error: delErr } = await supabase
      .from("precios_insumos")
      .delete()
      .eq("version_id", versionId);
    if (delErr) {
      report.errores.push({ seccion: "precios", row_excel: null, mensaje: `delete: ${delErr.message}` });
    } else {
      for (let i = 0; i < preciosToInsert.length; i += 500) {
        const chunk = preciosToInsert.slice(i, i + 500);
        const { error: insErr } = await supabase.from("precios_insumos").insert(chunk);
        if (insErr) {
          report.errores.push({ seccion: "precios", row_excel: null, mensaje: insErr.message });
          break;
        }
        report.precios_insertados += chunk.length;
      }
    }
  }

  // ──────────────── % Consumo ────────────────
  // Casos especiales: en la sección % Consumo, las filas "Caliza" y "Martillo"
  // representan el split de CALTLVTRIT entre dos roles, usando el nombre como proveedor.
  const PCT_ESPECIALES: Record<string, { codigo: string; proveedor: string }> = {
    "caliza":   { codigo: "CALTLVTRIT", proveedor: "caliza" },
    "martillo": { codigo: "CALTLVTRIT", proveedor: "martillo" },
  };

  const pctRows = parsed.porcentajes_consumo
    .map(p => {
      const nombreNorm = norm(p.material_nombre);
      const especial = PCT_ESPECIALES[nombreNorm];
      if (especial) {
        const materialId = idx.byCodigo.get(especial.codigo);
        if (!materialId) return null;
        return {
          version_id: versionId,
          material_id: materialId,
          proveedor: especial.proveedor,
          periodo: p.periodo,
          porcentaje: Number(p.porcentaje),
        };
      }
      const materialId = resolveMaterial(idx, p.material_nombre);
      if (!materialId) {
        noEncontrados.add(p.material_nombre);
        return null;
      }
      return {
        version_id: versionId,
        material_id: materialId,
        proveedor: p.proveedor,
        periodo: p.periodo,
        porcentaje: Number(p.porcentaje),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (pctRows.length > 0) {
    const pctDedup = new Map<string, typeof pctRows[number]>();
    for (const row of pctRows) {
      const k = `${row.material_id}|${row.proveedor ?? ""}|${row.periodo}`;
      pctDedup.set(k, row);
    }
    const pctToInsert = Array.from(pctDedup.values());

    await supabase.from("porcentajes_consumo").delete().eq("version_id", versionId);
    for (let i = 0; i < pctToInsert.length; i += 500) {
      const chunk = pctToInsert.slice(i, i + 500);
      const { error: insErr } = await supabase.from("porcentajes_consumo").insert(chunk);
      if (insErr) {
        report.errores.push({ seccion: "porcentajes_consumo", row_excel: null, mensaje: insErr.message });
        break;
      }
      report.porcentajes_insertados += chunk.length;
    }
  }

  // ──────────────── Humedades ────────────────
  const humRows = parsed.humedades
    .map(h => {
      const materialId = resolveMaterial(idx, h.material_nombre);
      if (!materialId) {
        noEncontrados.add(h.material_nombre);
        return null;
      }
      return {
        version_id: versionId,
        material_id: materialId,
        periodo: h.periodo,
        porcentaje: Number(h.porcentaje),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (humRows.length > 0) {
    await supabase.from("humedades").delete().eq("version_id", versionId);
    for (let i = 0; i < humRows.length; i += 500) {
      const chunk = humRows.slice(i, i + 500);
      const { error: insErr } = await supabase.from("humedades").insert(chunk);
      if (insErr) {
        report.errores.push({ seccion: "humedades", row_excel: null, mensaje: insErr.message });
        break;
      }
      report.humedades_insertadas += chunk.length;
    }
  }

  // ──────────────── Recetas ────────────────
  // Agrupar líneas por (producto, periodo). Por cada grupo creamos una receta + líneas.
  if (parsed.recetas.length > 0) {
    // Borrar recetas previas de la versión (cascade en BD ya las limpia)
    const { data: prevRecetas } = await supabase
      .from("recetas")
      .select("id")
      .eq("version_id", versionId);
    if (prevRecetas && prevRecetas.length > 0) {
      await supabase
        .from("recetas")
        .delete()
        .in("id", prevRecetas.map(r => r.id));
    }

    // Cargar procesos una vez (fuera del loop) — incluye nombre para matching robusto.
    const { data: allProcs } = await supabase
      .from("procesos")
      .select("id, material, nombre")
      .eq("activo", true);

    // Alias: nombre Excel abreviado → norm(procesos.material) para los casos que no
    // coinciden directamente (mismo patrón que build_context_from_excel.ts ALIASES).
    const RECETA_PROCESO_ALIASES: Record<string, string> = {
      "prehomo":  "mezcla prehomo",
      "crudo":    "harina cruda",
      "carbon":   "carbon molido",
      "carbón":   "carbon molido",
      "clinker":  "clinker",
      "alternos": "combustibles alternos",
      "cemento total": "cemento ug",
    };

    const resolveRecetaProceso = (producto: string): string | null => {
      const n = norm(producto);
      // 1) Match directo por material o nombre del proceso
      const direct = allProcs?.find(p => norm(p.material) === n || norm(p.nombre) === n);
      if (direct) return direct.id;
      // 2) Vía alias
      const aliasKey = RECETA_PROCESO_ALIASES[n];
      if (aliasKey) {
        const via = allProcs?.find(p => norm(p.material) === aliasKey || norm(p.nombre) === aliasKey);
        if (via) return via.id;
      }
      return null;
    };

    type Key = string;
    const grupos = new Map<Key, typeof parsed.recetas>();
    for (const ln of parsed.recetas) {
      const k = `${norm(ln.producto_nombre)}|${ln.periodo}`;
      const arr = grupos.get(k) ?? [];
      arr.push(ln);
      grupos.set(k, arr);
    }

    // Override de producto cuando el alias por defecto apunta a un material distinto
    // del que el motor de cálculo espera (caso ORD20: "Alternos" → COMBALT, no CDR).
    const RECETA_PRODUCTO_OVERRIDES: Record<string, string> = {
      "alternos": "COMBALT",
      "combustibles alternos": "COMBALT",
    };

    for (const lineas of Array.from(grupos.values())) {
      const producto = lineas[0].producto_nombre;
      const periodo = lineas[0].periodo;
      const productoNormKey = norm(producto);
      const productoOverrideCodigo = RECETA_PRODUCTO_OVERRIDES[productoNormKey];
      const productoId = productoOverrideCodigo
        ? idx.byCodigo.get(productoOverrideCodigo)
        : resolveMaterial(idx, producto);
      if (!productoId) {
        noEncontrados.add(producto);
        continue;
      }
      const procId = resolveRecetaProceso(producto);
      if (!procId) {
        report.errores.push({
          seccion: "recetas",
          row_excel: lineas[0].row_excel,
          mensaje: `Proceso no resuelto para producto "${producto}"`,
        });
        continue;
      }
      const { data: rec, error: recErr } = await supabase
        .from("recetas")
        .insert({
          version_id: versionId,
          producto_id: productoId,
          proceso_id: procId,
          periodo,
        })
        .select("id")
        .single();
      if (recErr || !rec) {
        report.errores.push({ seccion: "recetas", row_excel: null, mensaje: recErr?.message ?? "insert recetas falló" });
        continue;
      }
      report.recetas_creadas++;

      // Overrides contextuales por producto (mismo patrón que build_context_from_excel.ts).
      // Las claves cubren tanto el nombre completo como el abreviado del Excel.
      // El Excel usa nombres cortos en recetas (ej. "Prehomo En Crudo" → material="Prehomo",
      // "Mineral De Hierro En Crudo" → material="Mineral De Hierro") que no tienen alias directo.
      const RECETA_OVERRIDES: Record<string, Record<string, string>> = {
        "mezcla prehomo":  { "caliza": "CALTLVTRIT", "arcilla": "ARCTLVTRIT" },
        "prehomo":         { "caliza": "CALTLVTRIT", "arcilla": "ARCTLVTRIT" },
        "harina cruda":    {
          "prehomo": "MEZCPREHO",
          "caliza": "CALTLVTRIT",
          "mineral de hierro": "CORRHIERR",
          "calamina": "CALAMINA",
        },
        "crudo":           {
          "prehomo": "MEZCPREHO",
          "caliza": "CALTLVTRIT",
          "mineral de hierro": "CORRHIERR",
          "calamina": "CALAMINA",
        },
        "carbon molido":   {
          "mixtos": "CARB_MIXTO",
          "carbones finos": "CARB_FINO",
          "bituminoso": "CARBITUMI",
        },
        "carbón molido":   {
          "mixtos": "CARB_MIXTO",
          "carbones finos": "CARB_FINO",
          "bituminoso": "CARBITUMI",
        },
        "carbon":          {
          "mixtos": "CARB_MIXTO",
          "carbones finos": "CARB_FINO",
          "bituminoso": "CARBITUMI",
        },
        "carbón":          {
          "mixtos": "CARB_MIXTO",
          "carbones finos": "CARB_FINO",
          "bituminoso": "CARBITUMI",
        },
        "combustibles alternos": {
          "cdr": "CDR",
          "llanta": "TDF",
          "briquetas": "BRIQUETAS",
          "chip de madera": "BRIQUETAS",
        },
        "alternos":        {
          "cdr": "CDR",
          "llanta": "TDF",
          "briquetas": "BRIQUETAS",
          "chip de madera": "BRIQUETAS",
        },
        "clinker":         {
          "crudo": "HARINACRUD",
          "harina cruda": "HARINACRUD",
        },
        "cemento ug":      {
          "clinker": "CLINKER001",
          "caliza": "CALIZATRI",
          "yeso": "YESO00001",
          "sal marina": "ADIT_MOL",
          "finos": "CARB_FINO",
          "puzolana": "PUZOLANA",
          "aditivo de molienda": "ADIT_MOL",
        },
        "cemento art":     {
          "clinker": "CLINKER001",
          "caliza": "CALIZATRI",
          "yeso": "YESO00001",
        },
      };
      const productoNorm = norm(producto);
      const overrides = RECETA_OVERRIDES[productoNorm] ?? {};

      const lineasRows = lineas
        .map((ln, idx2) => {
          const lnNorm = norm(ln.material_nombre);
          const overrideCodigo = overrides[lnNorm];
          const materialId = overrideCodigo
            ? idx.byCodigo.get(overrideCodigo)
            : resolveMaterial(idx, ln.material_nombre);
          if (!materialId) {
            noEncontrados.add(ln.material_nombre);
            return null;
          }
          return {
            receta_id: rec.id,
            material_id: materialId,
            porcentaje: Number(ln.porcentaje),
            orden: idx2 + 1,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (lineasRows.length > 0) {
        const { error: lnErr } = await supabase.from("receta_lineas").insert(lineasRows);
        if (lnErr) {
          report.errores.push({ seccion: "recetas", row_excel: null, mensaje: `receta_lineas: ${lnErr.message}` });
        } else {
          report.receta_lineas_insertadas += lineasRows.length;
        }
      }
    }
  }

  // ──────────────── Ventas ────────────────
  if (parsed.ventas.length > 0) {
    await supabase.from("ventas_proyectadas").delete().eq("version_id", versionId);
    const rows = parsed.ventas
      .map(v => {
        const materialId = resolveMaterial(idx, v.material_nombre);
        if (!materialId) { noEncontrados.add(v.material_nombre); return null; }
        return {
          version_id: versionId,
          material_id: materialId,
          periodo: v.periodo,
          cantidad_ton: Number(v.cantidad_ton),
          presentacion: v.unidad,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("ventas_proyectadas").insert(chunk);
      if (error) { report.errores.push({ seccion: "ventas", row_excel: null, mensaje: error.message }); break; }
      report.ventas_insertadas += chunk.length;
    }
  }

  // ──────────────── Parámetros de energía ────────────────
  // Agrupar por periodo: precio_contrato, precio_restricciones, cargos_fijos,
  // kwh_ton_proceso (jsonb proceso→kWh/Ton derivado de la sección Rendimiento),
  // pci_combustibles (jsonb proveedor→PCI), kcal_tck_total, composicion_horno.
  if (
    parsed.parametros_energia.length > 0 ||
    parsed.combustibles_pci.length > 0 ||
    parsed.energia_termica.length > 0
  ) {
    type EnergiaRow = {
      version_id: string;
      periodo: string;
      precio_contrato: number | null;
      precio_restricciones: number | null;
      cargos_fijos: number | null;
      kwh_ton_proceso: Record<string, number> | null;
      pci_combustibles: Record<string, number> | null;
      kcal_tck_total: number | null;
      pci_ponderado_horno: number | null;
      composicion_horno: Record<string, number> | null;
      // Migración 006: modelo térmico horno
      kcal_tck: number | null;
      pct_energia_carbones: number | null;
      pct_energia_alternos: number | null;
      pct_energia_diesel: number | null;
      pci_ponderado_carbones: number | null;
      pci_ponderado_alternos: number | null;
      pci_ponderado_diesel: number | null;
    };
    const byPeriodo = new Map<string, EnergiaRow>();
    const ensure = (p: string): EnergiaRow => {
      const cur = byPeriodo.get(p);
      if (cur) return cur;
      const nuevo: EnergiaRow = {
        version_id: versionId, periodo: p,
        precio_contrato: null, precio_restricciones: null, cargos_fijos: null,
        kwh_ton_proceso: null, pci_combustibles: null,
        kcal_tck_total: null, pci_ponderado_horno: null, composicion_horno: null,
        kcal_tck: null,
        pct_energia_carbones: null, pct_energia_alternos: null, pct_energia_diesel: null,
        pci_ponderado_carbones: null, pci_ponderado_alternos: null, pci_ponderado_diesel: null,
      };
      byPeriodo.set(p, nuevo);
      return nuevo;
    };

    for (const e of parsed.parametros_energia) {
      const row = ensure(e.periodo);
      if (e.campo === "precio_contrato") row.precio_contrato = e.valor;
      else if (e.campo === "precio_restricciones") row.precio_restricciones = e.valor;
      else if (e.campo === "cargos_fijos") row.cargos_fijos = e.valor;
      else if (e.campo === "kwh_ton_proceso" && e.proceso_key) {
        row.kwh_ton_proceso = { ...(row.kwh_ton_proceso ?? {}), [e.proceso_key]: e.valor };
      }
    }
    for (const c of parsed.combustibles_pci) {
      const row = ensure(c.periodo);
      row.pci_combustibles = { ...(row.pci_combustibles ?? {}), [c.proveedor]: c.pci };
    }

    // Buffer para reconstruir PCIs ponderados (migración 006)
    const termRaw: Record<string, {
      masa_mixto?: number; masa_bitumin?: number; masa_fino?: number;
      pct_cdr?: number; pct_tdf?: number;
      pci_mixto?: number; pci_bitumin?: number; pci_fino?: number;
      pci_cdr?: number; pci_tdf?: number; pci_diesel?: number;
      pct_carbones?: number; pct_alternos?: number; pct_diesel?: number;
      kcal_tck?: number;
    }> = {};
    const bufFor = (p: string) => (termRaw[p] ??= {});

    for (const t of parsed.energia_termica) {
      const row = ensure(t.periodo);
      if (t.campo === "kcal_tck_total") row.kcal_tck_total = t.valor;
      else if (t.campo === "composicion" && t.componente) {
        row.composicion_horno = { ...(row.composicion_horno ?? {}), [t.componente]: t.valor };
      }
      const comp = (t.componente ?? "").toLowerCase();
      const buf = bufFor(t.periodo);
      if (/prueba pci/.test(comp))                                            buf.kcal_tck = t.valor;
      else if (/^energía carbones|^energia carbones/.test(comp))              buf.pct_carbones = t.valor;
      else if (/^energía alternos|^energia alternos/.test(comp))              buf.pct_alternos = t.valor;
      else if (/^energía diesel|^energia diesel/.test(comp))                  buf.pct_diesel = t.valor;
      else if (/carbón mixto seco \(masa\)|carbon mixto seco \(masa\)/.test(comp))            buf.masa_mixto = t.valor;
      else if (/carbón bituminoso seco \(masa\)|carbon bituminoso seco \(masa\)/.test(comp))  buf.masa_bitumin = t.valor;
      else if (/carbón fino seco \(masa\)|carbon fino seco \(masa\)/.test(comp))              buf.masa_fino = t.valor;
      else if (/^cdr seco/.test(comp))                                        buf.pct_cdr = t.valor;
      else if (/^tdf seco/.test(comp))                                        buf.pct_tdf = t.valor;
      else if (/pci ponderado carbón mixto|pci ponderado carbon mixto/.test(comp))           buf.pci_mixto = t.valor;
      else if (/pci ponderado carbón bituminoso|pci ponderado carbon bituminoso/.test(comp)) buf.pci_bitumin = t.valor;
      else if (/pci ponderado carbón fino|pci ponderado carbon fino/.test(comp))             buf.pci_fino = t.valor;
      else if (/pci ponderado cdr/.test(comp))                                buf.pci_cdr = t.valor;
      else if (/pci ponderado tdf/.test(comp))                                buf.pci_tdf = t.valor;
      else if (/pci ponderado diesel/.test(comp))                             buf.pci_diesel = t.valor;
    }

    // Volcar buffer → campos migración 006
    for (const [per, buf] of Object.entries(termRaw)) {
      const row = ensure(per);
      if (buf.kcal_tck != null)     row.kcal_tck = buf.kcal_tck;
      if (buf.pct_carbones != null) row.pct_energia_carbones = buf.pct_carbones;
      if (buf.pct_alternos != null) row.pct_energia_alternos = buf.pct_alternos;
      if (buf.pct_diesel != null)   row.pct_energia_diesel = buf.pct_diesel;
      if (buf.pci_diesel != null)   row.pci_ponderado_diesel = buf.pci_diesel;
      const partesC: Array<[number | undefined, number | undefined]> = [
        [buf.masa_mixto, buf.pci_mixto], [buf.masa_bitumin, buf.pci_bitumin], [buf.masa_fino, buf.pci_fino],
      ];
      let sumC = 0; let validC = false;
      for (const [m, p] of partesC) if (m != null && p != null) { sumC += m * p; validC = true; }
      if (validC) row.pci_ponderado_carbones = sumC;
      if (buf.pct_cdr != null && buf.pci_cdr != null && buf.pct_tdf != null && buf.pci_tdf != null) {
        row.pci_ponderado_alternos = buf.pct_cdr * buf.pci_cdr + buf.pct_tdf * buf.pci_tdf;
      }
    }

    const rows = Array.from(byPeriodo.values());
    if (rows.length > 0) {
      await (supabase as any).from("parametros_energia").delete().eq("version_id", versionId);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await (supabase as any).from("parametros_energia").insert(chunk);
        if (error) { report.errores.push({ seccion: "energia", row_excel: null, mensaje: error.message }); break; }
        report.parametros_energia_insertados += chunk.length;
      }
    }
  }

  // ──────────────── Rendimientos ────────────────
  // Agrupa por (proceso, periodo). Mapea proceso por nombre, ignorando "Cemento Total"
  // que es un agregado (no existe como proceso individual en BD).
  if (parsed.rendimientos.length > 0 || parsed.indicadores.length > 0) {
    const { data: procs } = await supabase.from("procesos").select("id, nombre, material").eq("activo", true);
    const procByNombre = new Map<string, string>();
    for (const p of procs ?? []) {
      procByNombre.set(norm(p.nombre), p.id);
      procByNombre.set(norm(p.material), p.id);
    }
    const resolveProceso = (n: string | null): string | null => {
      if (!n) return null;
      const key = norm(n);
      // Aliases adicionales para los nombres del Excel
      const aliases: Record<string, string> = {
        "ug": "cemento ug", "art": "cemento art",
        "trituración": "trituración", "trituracion": "trituración",
        "molienda crudo": "molienda de crudo",
        "molienda carbón": "molienda de carbón", "molienda carbon": "molienda de carbón",
      };
      return procByNombre.get(key) ?? procByNombre.get(norm(aliases[key] ?? "")) ?? null;
    };

    type RendRow = {
      version_id: string; proceso_id: string; periodo: string;
      horas_mes: number | null; produccion_ton: number | null;
      horas_operacion_efectivas: number | null; rendimiento_ton_hr: number | null;
      disponibilidad: number | null; utilizacion: number | null; oee: number | null;
    };
    const byKey = new Map<string, RendRow>();
    const ensureRend = (procId: string, p: string): RendRow => {
      const k = `${procId}|${p}`;
      const cur = byKey.get(k);
      if (cur) return cur;
      const nuevo: RendRow = {
        version_id: versionId, proceso_id: procId, periodo: p,
        horas_mes: null, produccion_ton: null,
        horas_operacion_efectivas: null, rendimiento_ton_hr: null,
        disponibilidad: null, utilizacion: null, oee: null,
      };
      byKey.set(k, nuevo);
      return nuevo;
    };

    for (const r of parsed.rendimientos) {
      const procId = resolveProceso(r.proceso_nombre);
      if (!procId) {
        if (r.proceso_nombre) procesosNoEncontrados.add(r.proceso_nombre);
        continue;
      }
      const row = ensureRend(procId, r.periodo);
      const campo = norm(r.campo);
      if (campo === "horas mes") row.horas_mes = r.valor;
      else if (/^produccion/i.test(campo)) row.produccion_ton = r.valor;
      else if (/horas de operacion/i.test(campo)) row.horas_operacion_efectivas = r.valor;
      else if (/^rendimiento/i.test(campo)) row.rendimiento_ton_hr = r.valor;
    }
    for (const ind of parsed.indicadores) {
      const procId = resolveProceso(ind.proceso_nombre);
      if (!procId) continue;
      const row = ensureRend(procId, ind.periodo);
      const c = norm(ind.concepto);
      if (/disponibilidad/i.test(c)) row.disponibilidad = ind.valor;
      else if (/utilizaci/i.test(c)) row.utilizacion = ind.valor;
      else if (/\boee\b/i.test(c)) row.oee = ind.valor;
    }

    const rows = Array.from(byKey.values());
    if (rows.length > 0) {
      await supabase.from("rendimientos").delete().eq("version_id", versionId);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("rendimientos").insert(chunk);
        if (error) { report.errores.push({ seccion: "rendimiento", row_excel: null, mensaje: error.message }); break; }
        report.rendimientos_insertados += chunk.length;
      }
    }
  }

  // ──────────────── Roturas ────────────────
  if (parsed.roturas.length > 0) {
    await supabase.from("roturas_sacos").delete().eq("version_id", versionId);
    type RotRow = { version_id: string; material_id: string | null; periodo: string; porcentaje_rotura: number };
    const rows: RotRow[] = parsed.roturas.map(r => {
      const matId = resolveMaterial(idx, r.material_nombre);
      return { version_id: versionId, material_id: matId, periodo: r.periodo, porcentaje_rotura: Number(r.porcentaje) };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("roturas_sacos").insert(chunk);
      if (error) { report.errores.push({ seccion: "rotura", row_excel: null, mensaje: error.message }); break; }
      report.roturas_insertadas += chunk.length;
    }
  }

  // ──────────────── Inventarios ────────────────
  if (parsed.inventarios.length > 0) {
    await supabase.from("inventarios_finales").delete().eq("version_id", versionId);
    const rows = parsed.inventarios
      .filter(i => i.campo === "inventario_final")
      .map(i => {
        const matId = resolveMaterial(idx, i.material_nombre);
        if (!matId) { noEncontrados.add(i.material_nombre); return null; }
        return {
          version_id: versionId, material_id: matId,
          periodo: i.periodo, cantidad_ton: Number(i.cantidad_ton),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("inventarios_finales").insert(chunk);
      if (error) { report.errores.push({ seccion: "inventarios", row_excel: null, mensaje: error.message }); break; }
      report.inventarios_insertados += chunk.length;
    }
  }

  // ──────────────── Overrides hoja Costo (Fase 1.7) ────────────────
  const hasOverrides =
    parsed.costos_fijos.length > 0 ||
    parsed.energia_overrides.length > 0 ||
    parsed.mp_overrides.length > 0;

  if (hasOverrides) {
    // Cargar mapa ord → proceso_id
    const { data: procsData } = await supabase.from("procesos").select("id, ord").eq("activo", true);
    const procesoIdByOrd = new Map<number, string>();
    for (const p of procsData ?? []) procesoIdByOrd.set(p.ord, p.id);

    // costos_fijos_proceso
    if (parsed.costos_fijos.length > 0) {
      await (supabase as any).from("costos_fijos_proceso").delete().eq("version_id", versionId);
      const rows = parsed.costos_fijos
        .map(cf => {
          const procId = procesoIdByOrd.get(cf.ord);
          if (!procId) { procesosNoEncontrados.add(`ORD ${cf.ord}`); return null; }
          return {
            version_id: versionId,
            proceso_id: procId,
            periodo: cf.periodo,
            codigo: cf.codigo,
            nombre: cf.nombre,
            costo_por_ton: cf.costo_por_ton,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await (supabase as any).from("costos_fijos_proceso").insert(chunk);
        if (error) { report.errores.push({ seccion: "costos_fijos", row_excel: null, mensaje: error.message }); break; }
        report.costos_fijos_insertados += chunk.length;
      }
    }

    // energia_overrides
    if (parsed.energia_overrides.length > 0) {
      await (supabase as any).from("energia_overrides").delete().eq("version_id", versionId);
      const rows = parsed.energia_overrides
        .map(eo => {
          const procId = procesoIdByOrd.get(eo.ord);
          if (!procId) { procesosNoEncontrados.add(`ORD ${eo.ord}`); return null; }
          return {
            version_id: versionId,
            proceso_id: procId,
            periodo: eo.periodo,
            kwh_ton: eo.kwh_ton,
            precio_efectivo: eo.precio_efectivo,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await (supabase as any).from("energia_overrides").insert(chunk);
        if (error) { report.errores.push({ seccion: "energia_overrides", row_excel: null, mensaje: error.message }); break; }
        report.energia_overrides_insertados += chunk.length;
      }
    }

    // mp_overrides
    if (parsed.mp_overrides.length > 0) {
      await (supabase as any).from("mp_overrides").delete().eq("version_id", versionId);
      const rows = parsed.mp_overrides
        .map(mp => {
          const procId = procesoIdByOrd.get(mp.ord);
          if (!procId) { procesosNoEncontrados.add(`ORD ${mp.ord}`); return null; }
          return {
            version_id: versionId,
            proceso_id: procId,
            material_codigo: mp.material_codigo,
            periodo: mp.periodo,
            consumo_ton_ton: mp.consumo_ton_ton,
            precio_cop_ton: mp.precio_cop_ton,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await (supabase as any).from("mp_overrides").insert(chunk);
        if (error) { report.errores.push({ seccion: "mp_overrides", row_excel: null, mensaje: error.message }); break; }
        report.mp_overrides_insertados += chunk.length;
      }
    }
  }

  report.materiales_no_encontrados = Array.from(noEncontrados).sort();
  report.procesos_no_encontrados = Array.from(procesosNoEncontrados).sort();
  return report;
}
