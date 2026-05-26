import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTO_ORD: Record<string, number> = {
  clinker:      5,
  "cemento-ug": 6,
  "cemento-art": 7,
  fibrocemento: 16,
};

const LOG_TIPOS = [
  "precio_componente_directo",
  "precio_componente_derivado",
  "costo_energia_proceso",
  "costo_componente_derivado_termico",
  "costo_fijo_proceso",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ base: string; comp: string; producto: string }> }
) {
  const { base, comp, producto } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const procesoOrd = PRODUCTO_ORD[producto.toLowerCase()];
  if (!procesoOrd) return NextResponse.json({ error: `producto desconocido: ${producto}` }, { status: 400 });

  const { data: proceso } = await supabase
    .from("procesos")
    .select("id, nombre")
    .eq("ord", procesoOrd)
    .maybeSingle();
  if (!proceso) return NextResponse.json({ error: "proceso no encontrado" }, { status: 404 });

  const procesoId   = proceso.id;
  const procesoNombre = proceso.nombre;

  // Últimos runs exitosos de cada versión
  async function getLastRunId(versionId: string): Promise<string | null> {
    const { data } = await supabase
      .from("calculation_runs")
      .select("id")
      .eq("version_id", versionId)
      .eq("estado", "exitoso")
      .order("iniciado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  const [baseRunId, compRunId] = await Promise.all([getLastRunId(base), getLastRunId(comp)]);
  if (!baseRunId || !compRunId) {
    return NextResponse.json({ error: "Una de las versiones no tiene run exitoso" }, { status: 400 });
  }

  // Cargar logs para un run
  async function getLogs(runId: string) {
    const { data } = await supabase
      .from("calculation_log")
      .select("calculo_tipo, concepto, valor_resultado, material_id")
      .eq("run_id", runId)
      .eq("proceso_id", procesoId)
      .in("calculo_tipo", [...LOG_TIPOS]);
    return data ?? [];
  }

  // Cargar pct (consumo) de la receta de una versión para este proceso
  async function getPctMap(versionId: string): Promise<Map<string, number>> {
    const { data } = await supabase
      .from("recetas")
      .select("periodo, receta_lineas(material_id, porcentaje)")
      .eq("version_id", versionId)
      .eq("proceso_id", procesoId);
    const map = new Map<string, number>();
    for (const r of data ?? []) {
      for (const ln of (r as any).receta_lineas ?? []) {
        map.set(ln.material_id as string, Number(ln.porcentaje));
      }
    }
    return map;
  }

  const [baseLogs, compLogs, basePct, compPct] = await Promise.all([
    getLogs(baseRunId),
    getLogs(compRunId),
    getPctMap(base),
    getPctMap(comp),
  ]);

  // Nombres de materiales
  const matIdSet = new Set<string>();
  for (const log of [...baseLogs, ...compLogs]) {
    if (log.material_id) matIdSet.add(log.material_id);
  }
  const allMatIds = Array.from(matIdSet);
  const { data: mats } = allMatIds.length > 0
    ? await supabase.from("materiales").select("id, nombre").in("id", allMatIds)
    : { data: [] };
  const matNombre = new Map<string, string>();
  for (const m of mats ?? []) matNombre.set(m.id, m.nombre);

  function costoDeLog(log: any, pctMap: Map<string, number>): number {
    if (log.calculo_tipo === "precio_componente_directo" || log.calculo_tipo === "precio_componente_derivado") {
      const pct = log.material_id ? (pctMap.get(log.material_id as string) ?? 0) : 0;
      return Number(log.valor_resultado) * pct;
    }
    return Number(log.valor_resultado);
  }

  function labelDeLog(log: any): string {
    if (log.material_id && matNombre.has(log.material_id as string)) {
      return matNombre.get(log.material_id as string)!;
    }
    if (log.calculo_tipo === "costo_energia_proceso") return "Energía Eléctrica";
    return String(log.concepto ?? log.calculo_tipo);
  }

  // Agrupar por concepto para cada versión
  const baseMap = new Map<string, number>();
  for (const log of baseLogs) {
    const key = labelDeLog(log);
    baseMap.set(key, (baseMap.get(key) ?? 0) + costoDeLog(log, basePct));
  }
  const compMap = new Map<string, number>();
  for (const log of compLogs) {
    const key = labelDeLog(log);
    compMap.set(key, (compMap.get(key) ?? 0) + costoDeLog(log, compPct));
  }

  const allKeys = Array.from(new Set([...Array.from(baseMap.keys()), ...Array.from(compMap.keys())]));
  const items = allKeys
    .map(k => ({
      label:     k,
      baseValue: baseMap.get(k) ?? 0,
      compValue: compMap.get(k) ?? 0,
      delta:     (compMap.get(k) ?? 0) - (baseMap.get(k) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const totalBase = Array.from(baseMap.values()).reduce((s, v) => s + v, 0);
  const totalComp = Array.from(compMap.values()).reduce((s, v) => s + v, 0);

  return NextResponse.json({
    proceso: procesoNombre,
    items,
    totales: { base: totalBase, comp: totalComp, delta: totalComp - totalBase },
  });
}
