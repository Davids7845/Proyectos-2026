// GET /api/versiones/[id]/costo-arrastrado?periodo=YYYY-MM-DD
//
// Devuelve los bloques del Costo Arrastrado para un período.
//
// Bloque CLINKER: Crudo (ORD 3) explotado × consumo de Crudo en Clinker
//                 + componentes propios de Clinker (ORD 5) sin Crudo.
// Resto de bloques: componentes directos de cada proceso (granel + empacados).
//   ORDs incluidos: 6,7,8,9,10,11,13,14,16,17,18,22
//
// Columna Real: TODO — dejar vacío hasta integrar tabla costos_reales.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TipoComponente = "mp_directo" | "mp_derivado" | "termico" | "energia" | "fijo";

interface ComponenteBloque {
  nombre: string;
  tipo: TipoComponente;
  consumo: number;
  costo_unit: number;
  total: number;
  bloque_origen?: string;
  real: null; // TODO: integrar costos_reales
}

interface BloqueResult {
  ord: number;
  nombre: string;
  componentes: ComponenteBloque[];
  total_costo: number;
  es_clinker?: boolean;
}

const LOG_TIPOS = [
  "precio_componente_directo",
  "precio_componente_derivado",
  "costo_componente_derivado_termico",
  "costo_energia_proceso",
  "costo_fijo_proceso",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const periodo = req.nextUrl.searchParams.get("periodo");
  if (!periodo) return NextResponse.json({ error: "periodo requerido" }, { status: 400 });

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });

  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", versionId)
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastRun) return NextResponse.json({ error: "Sin cálculos para esta versión" }, { status: 404 });

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", [3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 16, 17, 18, 22])
    .eq("activo", true);
  if (!procesos || procesos.length === 0) {
    return NextResponse.json({ error: "Procesos no encontrados" }, { status: 404 });
  }

  const byOrd = new Map(procesos.map(p => [p.ord, p]));
  const procesoIds = procesos.map(p => p.id);

  const [{ data: logs }, { data: recetas }] = await Promise.all([
    supabase
      .from("calculation_log")
      .select("id, calculo_tipo, proceso_id, material_id, concepto, valor_resultado, parametros_entrada")
      .eq("run_id", lastRun.id)
      .eq("periodo", periodo)
      .in("proceso_id", procesoIds)
      .in("calculo_tipo", [...LOG_TIPOS]),
    supabase
      .from("recetas")
      .select("proceso_id, periodo, receta_lineas(material_id, porcentaje)")
      .eq("version_id", versionId)
      .in("proceso_id", procesoIds),
  ]);

  // pct map: procesoId|materialId -> porcentaje (use period-matched receta; fall back to any)
  const pctByKey = new Map<string, number>();
  for (const r of (recetas ?? []) as Array<{ proceso_id: string; periodo: string; receta_lineas: Array<{ material_id: string; porcentaje: number }> }>) {
    const isPeriodo = r.periodo === periodo;
    for (const ln of r.receta_lineas ?? []) {
      const key = `${r.proceso_id}|${ln.material_id}`;
      if (isPeriodo || !pctByKey.has(key)) {
        pctByKey.set(key, Number(ln.porcentaje));
      }
    }
  }

  // Material names
  const matIds = Array.from(new Set((logs ?? []).map(l => l.material_id).filter(Boolean))) as string[];
  const { data: materiales } = matIds.length > 0
    ? await supabase.from("materiales").select("id, nombre").in("id", matIds)
    : { data: [] };
  const matNombre = new Map<string, string>();
  for (const m of materiales ?? []) matNombre.set(m.id, m.nombre);

  // Group logs by proceso_id
  type LogRow = { id: string; calculo_tipo: string; proceso_id: string; material_id: string | null; concepto: string | null; valor_resultado: number; parametros_entrada: Record<string, unknown> | null };
  const logsByProceso = new Map<string, LogRow[]>();
  for (const log of (logs ?? []) as LogRow[]) {
    if (!logsByProceso.has(log.proceso_id)) logsByProceso.set(log.proceso_id, []);
    logsByProceso.get(log.proceso_id)!.push(log);
  }

  function buildComponente(log: LogRow, consumoOverride?: number): ComponenteBloque | null {
    const params = (log.parametros_entrada ?? {}) as Record<string, unknown>;

    if (log.calculo_tipo === "precio_componente_directo" || log.calculo_tipo === "precio_componente_derivado") {
      const consumo = consumoOverride ?? (log.material_id ? (pctByKey.get(`${log.proceso_id}|${log.material_id}`) ?? 0) : 0);
      const costoUnit = Number(log.valor_resultado);
      return {
        nombre: log.material_id ? (matNombre.get(log.material_id) ?? log.concepto ?? "") : (log.concepto ?? ""),
        tipo: log.calculo_tipo === "precio_componente_directo" ? "mp_directo" : "mp_derivado",
        consumo,
        costo_unit: costoUnit,
        total: consumo * costoUnit,
        real: null,
      };
    }

    if (log.calculo_tipo === "costo_componente_derivado_termico") {
      const consumo = consumoOverride ?? Number(params.consumo ?? 0);
      const costoUnit = Number(params.precio_arrastrado ?? 0);
      return {
        nombre: log.material_id ? (matNombre.get(log.material_id) ?? log.concepto ?? "") : (log.concepto ?? ""),
        tipo: "termico",
        consumo,
        costo_unit: costoUnit,
        total: Number(log.valor_resultado),
        real: null,
      };
    }

    if (log.calculo_tipo === "costo_energia_proceso") {
      const consumo = Number(params.kwh_ton ?? 0);
      const costoTotal = Number(log.valor_resultado);
      return {
        nombre: "Energía Eléctrica",
        tipo: "energia",
        consumo,
        costo_unit: consumo > 0 ? costoTotal / consumo : 0,
        total: costoTotal,
        real: null,
      };
    }

    if (log.calculo_tipo === "costo_fijo_proceso") {
      const val = Number(log.valor_resultado);
      if (val === 0) return null; // placeholder
      return {
        nombre: String(params.codigo ?? log.concepto ?? "Costo fijo"),
        tipo: "fijo",
        consumo: 1,
        costo_unit: val,
        total: val,
        real: null,
      };
    }

    return null;
  }

  // ─── Bloque CLINKER ─────────────────────────────────────────────────────────
  const proc3 = byOrd.get(3);
  const proc5 = byOrd.get(5);
  const logs5 = logsByProceso.get(proc5?.id ?? "") ?? [];
  const clinkerComponentes: ComponenteBloque[] = [];

  // Find the Crudo derivado log in ORD 5 to get consumo_crudo
  const crudoDerivadoLog = logs5.find(l => l.calculo_tipo === "precio_componente_derivado");
  const crudoMatId = crudoDerivadoLog?.material_id ?? null;
  const consumo_crudo = crudoMatId
    ? (pctByKey.get(`${proc5!.id}|${crudoMatId}`) ?? 0)
    : 0;

  // ORD 3 (Crudo) components exploded × consumo_crudo
  if (proc3 && consumo_crudo > 0) {
    const logs3 = logsByProceso.get(proc3.id) ?? [];
    for (const log of logs3) {
      const comp = buildComponente(log);
      if (!comp) continue;
      const consumoScaled = comp.consumo * consumo_crudo;
      clinkerComponentes.push({
        ...comp,
        consumo: consumoScaled,
        total: consumoScaled * comp.costo_unit,
        bloque_origen: "crudo",
      });
    }
  }

  // ORD 5 own components (skip Crudo derivado)
  for (const log of logs5) {
    if (log.calculo_tipo === "precio_componente_derivado") continue;
    const comp = buildComponente(log);
    if (comp) clinkerComponentes.push({ ...comp, bloque_origen: "clinker" });
  }

  const bloqueClinker: BloqueResult = {
    ord: 5,
    nombre: proc5?.nombre ?? "Clinkerización",
    componentes: clinkerComponentes,
    total_costo: clinkerComponentes.reduce((s, c) => s + c.total, 0),
  };

  // ─── Resto de bloques (todos los procesos excepto Crudo y Clinker) ──────────
  function buildBloqueSimple(ord: number): BloqueResult {
    const proc = byOrd.get(ord);
    const componentes: ComponenteBloque[] = [];
    if (proc) {
      for (const log of logsByProceso.get(proc.id) ?? []) {
        const comp = buildComponente(log);
        if (comp) componentes.push(comp);
      }
    }
    return {
      ord,
      nombre: proc?.nombre ?? `ORD ${ord}`,
      componentes,
      total_costo: componentes.reduce((s, c) => s + c.total, 0),
    };
  }

  // Construir todos los bloques de procesos no-clinker con datos
  const ORDS_SIMPLES = [6, 7, 8, 9, 10, 11, 13, 14, 16, 17, 18, 22];
  const bloquesSimples = ORDS_SIMPLES
    .filter(ord => byOrd.has(ord))
    .map(ord => buildBloqueSimple(ord))
    .filter(b => b.componentes.length > 0);

  return NextResponse.json({
    version_id: versionId,
    periodo,
    consumo_crudo_en_clinker: consumo_crudo,
    bloques: [
      { ...bloqueClinker, es_clinker: true },
      ...bloquesSimples,
    ],
  });
}
