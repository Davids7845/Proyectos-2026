// GET /api/versiones/[id]/cementos-consolidado?periodo=YYYY-MM-DD
//
// Devuelve el costo consolidado de cementos calculado como promedio ponderado
// por producción de los 9 procesos finales (ORD 8, 9, 10, 11, 14, 16, 17, 18, 22).
//
//   costo_consolidado = SUM(costo_i × produccion_i) / SUM(produccion_i)
//
// Si no se pasa `periodo`, devuelve el detalle para todos los períodos en los
// que haya datos.
//
// ORD 21 es una vista derivada (Fase 3) — no tiene calculation_log propio.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ORDs cuyo costo y producción se promedian para el consolidado. */
export const ORDS_CONSOLIDADOS = [8, 9, 10, 11, 14, 16, 17, 18, 22] as const;

interface DesgloseRow {
  ord: number;
  nombre: string;
  costo_ton: number;
  produccion_ton: number;
  aporte: number;
  pct_total: number;
}

interface PeriodoResult {
  periodo: string;
  desglose: DesgloseRow[];
  total_produccion: number;
  costo_consolidado_ton: number;
  costo_total_periodo: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });

  const periodoParam = req.nextUrl.searchParams.get("periodo");

  // 1) Procesos a consolidar
  const { data: procesos, error: procErr } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", ORDS_CONSOLIDADOS as unknown as number[])
    .eq("activo", true);
  if (procErr) {
    return NextResponse.json({ error: `procesos: ${procErr.message}` }, { status: 500 });
  }
  if (!procesos || procesos.length === 0) {
    return NextResponse.json({ error: "No se encontraron procesos consolidables" }, { status: 404 });
  }
  const procesoIds = procesos.map(p => p.id);

  // 2) Último run de la versión — para localizar los costos de ese run
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", versionId)
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3) Costos por proceso × período desde costo_proceso (resultado del último run)
  let costoQuery = supabase
    .from("costo_proceso")
    .select("proceso_id, periodo, costo_por_ton")
    .in("proceso_id", procesoIds);
  if (lastRun?.id) costoQuery = costoQuery.eq("run_id", lastRun.id);
  if (periodoParam) costoQuery = costoQuery.eq("periodo", periodoParam);
  const { data: costos, error: costoErr } = await costoQuery;
  if (costoErr) return NextResponse.json({ error: `costo_proceso: ${costoErr.message}` }, { status: 500 });

  // 4) Producciones por proceso × período (tabla nueva Fase 3)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prodQuery = (supabase as any)
    .from("produccion_venta_periodo")
    .select("proceso_id, periodo, toneladas")
    .eq("version_id", versionId)
    .in("proceso_id", procesoIds);
  if (periodoParam) prodQuery = prodQuery.eq("periodo", periodoParam);
  const { data: producciones, error: prodErr } = await prodQuery;
  if (prodErr && !prodErr.message?.includes("does not exist")) {
    return NextResponse.json({ error: `produccion_venta_periodo: ${prodErr.message}` }, { status: 500 });
  }

  // 5) Reunir períodos presentes
  const periodosSet = new Set<string>();
  for (const c of costos ?? []) periodosSet.add(c.periodo);
  for (const p of (producciones ?? []) as Array<{ periodo: string }>) periodosSet.add(p.periodo);
  const periodos = periodoParam ? [periodoParam] : Array.from(periodosSet).sort();

  // Index para lookup O(1)
  const costoByKey = new Map<string, number>();
  for (const c of costos ?? []) {
    costoByKey.set(`${c.proceso_id}|${c.periodo}`, Number(c.costo_por_ton));
  }
  const prodByKey = new Map<string, number>();
  for (const p of (producciones ?? []) as Array<{ proceso_id: string; periodo: string; toneladas: number | null }>) {
    prodByKey.set(`${p.proceso_id}|${p.periodo}`, Number(p.toneladas ?? 0));
  }

  // 6) Calcular consolidado por período
  const resultado: PeriodoResult[] = [];
  for (const periodo of periodos) {
    let sumaCostoPorProd = 0;
    let sumaProd = 0;
    const desgloseRaw: Array<Omit<DesgloseRow, "pct_total">> = [];

    for (const p of procesos) {
      const costo = costoByKey.get(`${p.id}|${periodo}`) ?? 0;
      const prod = prodByKey.get(`${p.id}|${periodo}`) ?? 0;
      const aporte = costo * prod;
      desgloseRaw.push({
        ord: p.ord,
        nombre: p.nombre,
        costo_ton: costo,
        produccion_ton: prod,
        aporte,
      });
      sumaCostoPorProd += aporte;
      sumaProd += prod;
    }

    const costoConsolidado = sumaProd > 0 ? sumaCostoPorProd / sumaProd : 0;
    const desglose: DesgloseRow[] = desgloseRaw.map(d => ({
      ...d,
      pct_total: sumaCostoPorProd > 0 ? (d.aporte / sumaCostoPorProd) * 100 : 0,
    }));

    resultado.push({
      periodo,
      desglose,
      total_produccion: sumaProd,
      costo_consolidado_ton: costoConsolidado,
      costo_total_periodo: sumaCostoPorProd,
    });
  }

  return NextResponse.json({
    version_id: versionId,
    procesos_consolidados: ORDS_CONSOLIDADOS,
    resultado,
  });
}
