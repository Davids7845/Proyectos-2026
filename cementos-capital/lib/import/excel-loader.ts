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
    materiales_no_encontrados: [],
    errores: [...parsed.errors],
  };

  const idx = await loadMaterialesIndex(supabase);
  const noEncontrados = new Set<string>();

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

  report.materiales_no_encontrados = Array.from(noEncontrados).sort();
  return report;
}
