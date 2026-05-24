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
    materiales_no_encontrados: [],
    procesos_no_encontrados: [],
    errores: [...parsed.errors],
  };

  const idx = await loadMaterialesIndex(supabase);
  const noEncontrados = new Set<string>();
  const procesosNoEncontrados = new Set<string>();

  // ──────────────── Precios ────────────────
  const preciosRows = parsed.precios
    .map(p => {
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
    // Upsert: borramos preexistentes de la versión y reinsertamos en batch.
    // Más simple que onConflict con coalesce(proveedor,'').
    const { error: delErr } = await supabase
      .from("precios_insumos")
      .delete()
      .eq("version_id", versionId);
    if (delErr) {
      report.errores.push({ seccion: "precios", row_excel: null, mensaje: `delete: ${delErr.message}` });
    } else {
      // Insert en chunks de 500
      for (let i = 0; i < preciosRows.length; i += 500) {
        const chunk = preciosRows.slice(i, i + 500);
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
  const pctRows = parsed.porcentajes_consumo
    .map(p => {
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
    await supabase.from("porcentajes_consumo").delete().eq("version_id", versionId);
    for (let i = 0; i < pctRows.length; i += 500) {
      const chunk = pctRows.slice(i, i + 500);
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

    type Key = string;
    const grupos = new Map<Key, typeof parsed.recetas>();
    for (const ln of parsed.recetas) {
      const k = `${norm(ln.producto_nombre)}|${ln.periodo}`;
      const arr = grupos.get(k) ?? [];
      arr.push(ln);
      grupos.set(k, arr);
    }

    for (const lineas of Array.from(grupos.values())) {
      const producto = lineas[0].producto_nombre;
      const periodo = lineas[0].periodo;
      const productoId = resolveMaterial(idx, producto);
      if (!productoId) {
        noEncontrados.add(producto);
        continue;
      }
      // Resolver proceso: por convención producto = nombre del material asociado al ORD.
      // Como aún no tenemos un mapeo producto→proceso, usamos el primer proceso activo.
      const { data: procs } = await supabase
        .from("procesos")
        .select("id, material")
        .eq("activo", true);
      const proc = procs?.find(p => norm(p.material) === norm(producto));
      if (!proc) {
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
          proceso_id: proc.id,
          periodo,
        })
        .select("id")
        .single();
      if (recErr || !rec) {
        report.errores.push({ seccion: "recetas", row_excel: null, mensaje: recErr?.message ?? "insert recetas falló" });
        continue;
      }
      report.recetas_creadas++;

      const lineasRows = lineas
        .map((ln, idx2) => {
          const materialId = resolveMaterial(idx, ln.material_nombre);
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
      };
      byPeriodo.set(p, nuevo);
      return nuevo;
    };

    for (const e of parsed.parametros_energia) {
      const row = ensure(e.periodo);
      if (e.campo === "precio_contrato") row.precio_contrato = e.valor;
      else if (e.campo === "precio_restricciones") row.precio_restricciones = e.valor;
      else if (e.campo === "cargos_fijos") row.cargos_fijos = e.valor;
    }
    for (const c of parsed.combustibles_pci) {
      const row = ensure(c.periodo);
      row.pci_combustibles = { ...(row.pci_combustibles ?? {}), [c.proveedor]: c.pci };
    }
    for (const t of parsed.energia_termica) {
      const row = ensure(t.periodo);
      if (t.campo === "kcal_tck_total") row.kcal_tck_total = t.valor;
      else if (t.campo === "composicion" && t.componente) {
        row.composicion_horno = { ...(row.composicion_horno ?? {}), [t.componente]: t.valor };
      }
    }

    const rows = Array.from(byPeriodo.values());
    if (rows.length > 0) {
      await supabase.from("parametros_energia").delete().eq("version_id", versionId);
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from("parametros_energia").insert(chunk);
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

  report.materiales_no_encontrados = Array.from(noEncontrados).sort();
  report.procesos_no_encontrados = Array.from(procesosNoEncontrados).sort();
  return report;
}
