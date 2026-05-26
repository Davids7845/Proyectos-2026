// Trazabilidad hacia adelante: dado un material, calcula su aporte a cada
// producto final (ORD ∈ {6,7,8,9,10,11,14,15,16,19,21}) por periodo.
//
// Heurística: el motor logea entradas de tipo precio_componente_directo /
// precio_componente_derivado con material_id == X cuando ese material
// participa (directa o derivativamente) en el costo de un proceso. Sumar
// esos valor_resultado por proceso da el aporte; dividir por costo_por_ton
// del proceso da el % de contribución.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Procesos terminales (productos finales) — coincide con los ords usados en
// la vista comparador y dashboard.
const FINAL_ORDS = [6, 7, 8, 9, 10, 11, 14, 15, 16, 19, 21];

interface Aporte {
  proceso_id: string;
  ord: number;
  nombre_proceso: string;
  periodo: string;
  aporte_cop_ton: number;     // suma valor_resultado de las entradas para ese material en ese proceso
  costo_proceso_cop_ton: number; // costo_por_ton del proceso
  pct_costo: number;          // aporte_cop_ton / costo_proceso_cop_ton (0..1)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id: versionId, materialId } = await params;
  const supabase = await createClient();

  // 1) Resolver material
  const { data: material, error: matErr } = await supabase
    .from("materiales")
    .select("id, codigo, nombre, unidad_base")
    .eq("id", materialId)
    .single();
  if (matErr || !material) {
    return NextResponse.json({ error: "material no encontrado" }, { status: 404 });
  }

  // 2) Último run de la versión
  const { data: runs } = await supabase
    .from("calculation_runs")
    .select("id, estado, finalizado_en")
    .eq("version_id", versionId)
    .eq("estado", "exitoso")
    .order("finalizado_en", { ascending: false })
    .limit(1);
  const runId = runs?.[0]?.id;
  if (!runId) {
    return NextResponse.json({
      material: { id: material.id, codigo: material.codigo, nombre: material.nombre },
      aportes: [],
      mensaje: "No hay runs exitosos para esta versión",
    });
  }

  // 3) Procesos finales
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", FINAL_ORDS);
  const procesosById = new Map<string, { ord: number; nombre: string }>(
    (procesos ?? []).map(p => [p.id as string, { ord: p.ord as number, nombre: p.nombre as string }]),
  );

  // 4) Entradas de calc_log con este material en procesos finales (último run)
  const { data: logs, error: logsErr } = await supabase
    .from("calculation_log")
    .select("proceso_id, periodo, valor_resultado, calculo_tipo")
    .eq("run_id", runId)
    .eq("material_id", materialId)
    .in("proceso_id", Array.from(procesosById.keys()));
  if (logsErr) return NextResponse.json({ error: logsErr.message }, { status: 500 });

  // 5) Costo por ton de los procesos finales
  const { data: costos } = await supabase
    .from("costo_proceso")
    .select("proceso_id, periodo, costo_por_ton")
    .eq("run_id", runId)
    .in("proceso_id", Array.from(procesosById.keys()));
  const costoByKey = new Map<string, number>(
    (costos ?? []).map(c => [`${c.proceso_id}|${c.periodo}`, Number(c.costo_por_ton)]),
  );

  // 6) Agregar valor_resultado por (proceso, periodo)
  const sumByKey = new Map<string, number>();
  for (const l of logs ?? []) {
    // Sólo tipos de aporte unitario (excluye totales agregados que ya están en costo_proceso)
    if (!["precio_componente_directo", "precio_componente_derivado", "costo_mp_prehomo", "costo_mp_adiciones"].includes(l.calculo_tipo as string)) continue;
    const k = `${l.proceso_id}|${l.periodo}`;
    sumByKey.set(k, (sumByKey.get(k) ?? 0) + Number(l.valor_resultado));
  }

  // 7) Construir aportes
  const aportes: Aporte[] = [];
  for (const [k, aporte] of Array.from(sumByKey.entries())) {
    const [proceso_id, periodo] = k.split("|");
    const meta = procesosById.get(proceso_id);
    if (!meta) continue;
    const costo = costoByKey.get(k) ?? 0;
    aportes.push({
      proceso_id,
      ord: meta.ord,
      nombre_proceso: meta.nombre,
      periodo,
      aporte_cop_ton: aporte,
      costo_proceso_cop_ton: costo,
      pct_costo: costo > 0 ? aporte / costo : 0,
    });
  }

  aportes.sort((a, b) => (a.ord - b.ord) || a.periodo.localeCompare(b.periodo));

  return NextResponse.json({
    material: { id: material.id, codigo: material.codigo, nombre: material.nombre },
    run_id: runId,
    aportes,
    total_aporte_cop_ton: aportes.reduce((s, a) => s + a.aporte_cop_ton, 0),
  });
}
