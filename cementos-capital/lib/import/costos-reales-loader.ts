// Carga filas parseadas del parser costos-reales-parser.ts a la tabla
// costos_reales de Supabase. Resuelve proceso_id y material_id desde
// los catálogos, e inserta por bloques con upsert idempotente.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CostoRealParsed } from "./costos-reales-parser";

export interface CostosRealesLoadReport {
  insertadas: number;
  omitidas: number;
  errores: string[];
}

interface ProcRow { id: string; ord: number }
interface MatRow  { id: string; codigo: string }

async function loadCatalogs(supabase: SupabaseClient<any>) {
  const [{ data: procs }, { data: mats }] = await Promise.all([
    supabase.from("procesos").select("id, ord"),
    supabase.from("materiales").select("id, codigo"),
  ]);
  const byOrd  = new Map<number, string>((procs as ProcRow[]).map(p => [p.ord, p.id]));
  const byCod  = new Map<string, string>((mats  as MatRow[] ).map(m => [m.codigo, m.id]));
  return { byOrd, byCod };
}

export async function loadCostosReales(
  supabase: SupabaseClient<any>,
  versionId: string,
  periodo: string,    // ISO date primer día del mes, ej. "2026-01-01"
  filas: CostoRealParsed[]
): Promise<CostosRealesLoadReport> {
  const report: CostosRealesLoadReport = { insertadas: 0, omitidas: 0, errores: [] };
  if (filas.length === 0) return report;

  const { byOrd, byCod } = await loadCatalogs(supabase);

  const rows: Record<string, unknown>[] = [];

  for (const f of filas) {
    const proceso_id = byOrd.get(f.proceso_ord);
    if (!proceso_id) {
      report.errores.push(`ORD ${f.proceso_ord} no encontrado (row ${f.row_excel})`);
      report.omitidas++;
      continue;
    }

    let material_id: string | null = null;
    if (f.concepto_tipo === "material") {
      const mid = byCod.get(f.concepto_codigo);
      if (!mid) {
        report.errores.push(
          `Material "${f.concepto_codigo}" no encontrado (ORD ${f.proceso_ord}, row ${f.row_excel})`
        );
        report.omitidas++;
        continue;
      }
      material_id = mid;
    }

    rows.push({
      version_id:      versionId,
      periodo,
      proceso_id,
      material_id,
      concepto_tipo:   f.concepto_tipo,
      concepto_codigo: f.concepto_codigo,
      row_excel:       f.row_excel,
      consumo:         f.consumo,
      precio_unitario: f.precio_unitario,
      valor_monetario: f.valor_monetario,
      unidad:          f.unidad,
    });
  }

  if (rows.length === 0) return report;

  // Eliminar filas previas del mismo (version, periodo) para idempotencia
  await supabase
    .from("costos_reales")
    .delete()
    .eq("version_id", versionId)
    .eq("periodo", periodo);

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("costos_reales").insert(chunk);
    if (error) {
      report.errores.push(`insert chunk ${i}–${i + chunk.length}: ${error.message}`);
    } else {
      report.insertadas += chunk.length;
    }
  }

  return report;
}
