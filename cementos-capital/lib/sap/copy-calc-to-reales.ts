// Traduce los movimientos de un run del motor de cálculo a filas en
// la tabla `costos_reales`. Útil cuando se quiere usar el motor con
// datos reales (precios/recetas/rendimientos reales) y aprovechar la
// vista de desviaciones existente.
//
// Mecánica:
//   1. Lee movimientos_contables del run filtrado por tipo='entrada'.
//   2. Divide valor_monetario absoluto entre producción para obtener
//      COP/Ton (consistente con costos_reales).
//   3. Mapea cada movimiento a un concepto_tipo según la clasificación:
//      - material_id presente   → 'material'
//      - clasificacion = 'FIJO' → 'fijo'
//      - el resto              → 'energia'
//   4. Borra filas previas (version, periodo) con origen='calc' y reemplaza.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CopyCalcToRealesOpts {
  versionId: string;
  runId: string;
  /** Si se omite, copia todos los períodos del run. */
  periodo?: string;
}

export interface CopyCalcToRealesReport {
  insertadas: number;
  omitidas: number;
  errores: string[];
  periodos_procesados: string[];
}

export async function copyCalcToReales(
  supabase: SupabaseClient<any>,
  opts: CopyCalcToRealesOpts
): Promise<CopyCalcToRealesReport> {
  const report: CopyCalcToRealesReport = {
    insertadas: 0,
    omitidas: 0,
    errores: [],
    periodos_procesados: [],
  };

  // 1. Movimientos del run (entradas con valor monetario)
  let movQuery = supabase
    .from("movimientos_contables")
    .select("periodo, proceso_id, material_id, clase_costo_id, valor_monetario, clasificacion, tipo_insumo")
    .eq("run_id", opts.runId)
    .eq("tipo_movimiento", "entrada");
  if (opts.periodo) movQuery = movQuery.eq("periodo", opts.periodo);

  const { data: movs, error: movErr } = await movQuery;
  if (movErr) {
    report.errores.push(`movimientos_contables: ${movErr.message}`);
    return report;
  }
  if (!movs || movs.length === 0) {
    report.errores.push("No hay movimientos para este run (¿se generaron movimientos contables?)");
    return report;
  }

  // 2. Catálogos: rendimientos, materiales, clases de costo
  const [{ data: rends }, { data: mats }, { data: clases }] = await Promise.all([
    supabase
      .from("rendimientos")
      .select("proceso_id, periodo, produccion_ton")
      .eq("version_id", opts.versionId),
    supabase.from("materiales").select("id, codigo"),
    supabase.from("clases_costo").select("id, codigo"),
  ]);

  const rendMap = new Map<string, number>();
  for (const r of (rends ?? []) as any[]) {
    rendMap.set(
      `${r.proceso_id}|${r.periodo}`,
      Number(r.produccion_ton ?? 0)
    );
  }
  const matCodigo = new Map<string, string>(
    ((mats ?? []) as any[]).map((m: any) => [m.id, m.codigo])
  );
  const claseCodigo = new Map<string, string>(
    ((clases ?? []) as any[]).map((c: any) => [c.id, c.codigo])
  );

  // 3. Agregar por (periodo, proceso, material, concepto) y convertir a COP/Ton
  type Key = string;
  const agg = new Map<Key, {
    periodo: string;
    proceso_id: string;
    material_id: string | null;
    concepto_tipo: "material" | "energia" | "fijo";
    concepto_codigo: string;
    valor_abs: number;
  }>();

  for (const m of movs as any[]) {
    const valorAbs = Number(m.valor_monetario ?? 0);
    if (!isFinite(valorAbs) || valorAbs === 0) continue;

    const matId: string | null = m.material_id ?? null;
    let concepto_tipo: "material" | "energia" | "fijo";
    let concepto_codigo: string;

    if (matId) {
      concepto_tipo = "material";
      concepto_codigo = matCodigo.get(matId) ?? matId;
    } else if (m.clasificacion === "FIJO") {
      concepto_tipo = "fijo";
      concepto_codigo = String(m.tipo_insumo ?? claseCodigo.get(m.clase_costo_id) ?? "FIJO");
    } else {
      concepto_tipo = "energia";
      concepto_codigo = "ENERGIA";
    }

    const key = `${m.periodo}|${m.proceso_id}|${matId ?? ""}|${concepto_tipo}|${concepto_codigo}`;
    const cur = agg.get(key);
    if (cur) {
      cur.valor_abs += valorAbs;
    } else {
      agg.set(key, {
        periodo: m.periodo,
        proceso_id: m.proceso_id,
        material_id: matId,
        concepto_tipo,
        concepto_codigo,
        valor_abs: valorAbs,
      });
    }
  }

  // 4. Construir filas para insert convirtiendo a COP/Ton
  const rows: Record<string, unknown>[] = [];
  const periodosSet = new Set<string>();
  for (const v of Array.from(agg.values())) {
    const prod = rendMap.get(`${v.proceso_id}|${v.periodo}`) ?? 0;
    if (prod <= 0) {
      report.omitidas++;
      continue;
    }
    const valorUnit = v.valor_abs / prod;
    periodosSet.add(v.periodo);
    rows.push({
      version_id:      opts.versionId,
      periodo:         v.periodo,
      proceso_id:      v.proceso_id,
      material_id:     v.material_id,
      concepto_tipo:   v.concepto_tipo,
      concepto_codigo: v.concepto_codigo,
      row_excel:       null,
      consumo:         null,
      precio_unitario: null,
      valor_monetario: Number(valorUnit.toFixed(2)),
      unidad:          v.concepto_tipo === "energia" ? "kWh" : "T",
      origen:          "calc",
      run_id:          opts.runId,
    });
  }

  if (rows.length === 0) {
    report.errores.push("Sin filas a insertar (verifica que el run tenga producción registrada)");
    return report;
  }

  // 5. Idempotencia: borrar TODAS las filas (excel + calc) de los períodos
  //    afectados. Cargar 'calc' reemplaza por completo el período, como
  //    lo hace el loader de Excel.
  const periodosArr = Array.from(periodosSet);
  const { error: delErr } = await supabase
    .from("costos_reales")
    .delete()
    .eq("version_id", opts.versionId)
    .in("periodo", periodosArr);
  if (delErr) {
    report.errores.push(`delete previo: ${delErr.message}`);
    return report;
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("costos_reales").insert(chunk);
    if (error) {
      report.errores.push(`insert chunk ${i}: ${error.message}`);
    } else {
      report.insertadas += chunk.length;
    }
  }

  report.periodos_procesados = Array.from(periodosSet).sort();
  return report;
}
