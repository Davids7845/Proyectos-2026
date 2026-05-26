// Endpoint que genera el reporte PDF ejecutivo.
// GET /api/versiones/[id]/pdf

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { ReporteEjecutivo, type ReporteData } from "@/components/pdf/ReporteEjecutivo";

export const runtime = "nodejs";

const FINAL_ORDS = [6, 7, 8, 9, 10, 11, 14, 15, 16, 19, 21];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado, periodo_inicio, periodo_fin")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });

  // Último run exitoso
  const { data: runs } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", versionId)
    .eq("estado", "exitoso")
    .order("finalizado_en", { ascending: false })
    .limit(1);
  const runId = runs?.[0]?.id as string | undefined;

  // Procesos
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .eq("activo", true)
    .order("ord");

  const procesosArr = (procesos ?? []).map(p => ({ id: p.id as string, ord: p.ord as number, nombre: p.nombre as string }));
  const procesosById = new Map(procesosArr.map(p => [p.id, p]));
  const finalProcIds = procesosArr.filter(p => FINAL_ORDS.includes(p.ord)).map(p => p.id);

  // Datos del run
  const [
    { data: costos },
    { data: rendimientos },
    { data: logs },
    { data: materiales },
  ] = runId
    ? await Promise.all([
        supabase.from("costo_proceso").select("proceso_id, periodo, costo_por_ton, costo_total").eq("run_id", runId),
        supabase.from("rendimientos").select("proceso_id, periodo, produccion_ton").eq("version_id", versionId),
        supabase
          .from("calculation_log")
          .select("proceso_id, material_id, valor_resultado, calculo_tipo")
          .eq("run_id", runId)
          .in("calculo_tipo", ["precio_componente_directo", "precio_componente_derivado", "costo_mp_prehomo", "costo_mp_adiciones"])
          .in("proceso_id", finalProcIds),
        supabase.from("materiales").select("id, codigo, nombre"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  // Periodos detectados
  const periodosSet = new Set<string>();
  for (const c of (costos ?? []) as Array<{ periodo: string }>) periodosSet.add(c.periodo);
  const periodos = Array.from(periodosSet).sort();

  // Matriz costoPorProcesoPeriodo (key: ord|periodo → costo_por_ton)
  const costoPorProcesoPeriodo: Record<string, number> = {};
  const produccionPorProcesoPeriodo: Record<string, number> = {};
  for (const c of (costos ?? []) as Array<{ proceso_id: string; periodo: string; costo_por_ton: number }>) {
    const proc = procesosById.get(c.proceso_id);
    if (!proc) continue;
    costoPorProcesoPeriodo[`${proc.ord}|${c.periodo}`] = Number(c.costo_por_ton);
  }
  for (const r of (rendimientos ?? []) as Array<{ proceso_id: string; periodo: string; produccion_ton: number | null }>) {
    const proc = procesosById.get(r.proceso_id);
    if (!proc || r.produccion_ton == null) continue;
    produccionPorProcesoPeriodo[`${proc.ord}|${r.periodo}`] = Number(r.produccion_ton);
  }

  // Resumen productos finales
  const productosFinales: ReporteData["productosFinales"] = [];
  for (const proc of procesosArr.filter(p => FINAL_ORDS.includes(p.ord))) {
    const valoresArr: number[] = [];
    for (const per of periodos) {
      const v = costoPorProcesoPeriodo[`${proc.ord}|${per}`];
      if (v != null && isFinite(v)) valoresArr.push(v);
    }
    if (valoresArr.length > 0) {
      const promedio = valoresArr.reduce((s, x) => s + x, 0) / valoresArr.length;
      productosFinales.push({
        ord: proc.ord,
        nombre: proc.nombre,
        costoPromedio: promedio,
        costoMinimo:   Math.min(...valoresArr),
        costoMaximo:   Math.max(...valoresArr),
      });
    }
  }

  // Top 5 insumos por aporte agregado
  const matById = new Map<string, { codigo: string; nombre: string }>(
    (materiales ?? []).map((m: { id: string; codigo: string; nombre: string }) => [m.id, { codigo: m.codigo, nombre: m.nombre }]),
  );
  const aporteByMat = new Map<string, number>();
  for (const l of (logs ?? []) as Array<{ material_id: string | null; valor_resultado: number }>) {
    if (!l.material_id) continue;
    aporteByMat.set(l.material_id, (aporteByMat.get(l.material_id) ?? 0) + Number(l.valor_resultado));
  }
  const totalAporte = Array.from(aporteByMat.values()).reduce((s, x) => s + x, 0);
  const topInsumos: ReporteData["topInsumos"] = Array.from(aporteByMat.entries())
    .map(([id, aporte]) => {
      const m = matById.get(id);
      return {
        codigo: m?.codigo ?? id.slice(0, 8),
        nombre: m?.nombre ?? "(material desconocido)",
        aporteTotalCop: aporte,
        pctEstimado: totalAporte > 0 ? aporte / totalAporte : 0,
      };
    })
    .sort((a, b) => b.aporteTotalCop - a.aporteTotalCop)
    .slice(0, 5);

  const data: ReporteData = {
    versionNombre: version.nombre,
    versionEstado: version.estado,
    periodoInicio: version.periodo_inicio,
    periodoFin:    version.periodo_fin,
    generadoEn:    new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
    procesos: procesosArr.map(p => ({ ord: p.ord, nombre: p.nombre })),
    periodos,
    costoPorProcesoPeriodo,
    produccionPorProcesoPeriodo,
    productosFinales,
    topInsumos,
  };

  // ESLint: react-pdf usa createElement no JSX en server route.
  // Cast a any porque renderToBuffer espera DocumentProps pero acepta cualquier
  // elemento que produzca un <Document/> en su raíz (que es lo que hace ReporteEjecutivo).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(ReporteEjecutivo, { data }) as any);

  const filename = `reporte-${version.nombre.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
