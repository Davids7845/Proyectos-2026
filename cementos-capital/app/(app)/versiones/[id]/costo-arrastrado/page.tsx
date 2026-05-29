// Vista Costo Arrastrado — réplica de la hoja "Costo Arrastrado" del Excel.
//
// 4 bloques: Clinker (Crudo explotado + componentes propios), Cemento UG, ART, Fibrocemento.
// Columna Real: TODO — vacía hasta integrar costos_reales.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCOP, formatMes, BRAND } from "@/lib/ui/colors";

interface ComponenteBloque {
  nombre: string;
  tipo: "mp_directo" | "mp_derivado" | "termico" | "energia" | "fijo";
  consumo: number;
  costo_unit: number;
  total: number;
  bloque_origen?: string;
  real: null;
}

interface BloqueResult {
  ord: number;
  nombre: string;
  componentes: ComponenteBloque[];
  total_costo: number;
}

interface CostoArrastradoData {
  version_id: string;
  periodo: string;
  consumo_crudo_en_clinker: number;
  bloques: {
    clinker: BloqueResult;
    cemento_ug: BloqueResult;
    cemento_art: BloqueResult;
    fibrocemento: BloqueResult;
  };
}

export default async function CostoArrastradoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { id } = await params;
  const { periodo: periodoParam } = await searchParams;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // Get available periods from costo_proceso
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", id)
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: costoPeriodos } = lastRun
    ? await supabase
        .from("costo_proceso")
        .select("periodo")
        .eq("run_id", lastRun.id)
        .order("periodo")
    : { data: [] };

  const periodos = Array.from(new Set((costoPeriodos ?? []).map(r => r.periodo as string))).sort();

  if (periodos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={version.nombre} />
        <EmptyState mensaje="Aún no hay cálculos para esta versión." />
      </div>
    );
  }

  const periodoSel = periodoParam && periodos.includes(periodoParam)
    ? periodoParam
    : periodos[periodos.length - 1];

  // Fetch block data via internal logic (same as API route)
  const data = await fetchCostoArrastrado(supabase, id, lastRun!.id, periodoSel);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={version.nombre} />
        <EmptyState mensaje="No se encontraron datos de costo arrastrado para el período seleccionado." />
      </div>
    );
  }

  const bloqueList = [
    { key: "clinker", bloque: data.bloques.clinker, color: BRAND.productos.clinker },
    { key: "cemento_ug", bloque: data.bloques.cemento_ug, color: BRAND.productos.ug },
    { key: "cemento_art", bloque: data.bloques.cemento_art, color: BRAND.productos.art },
    { key: "fibrocemento", bloque: data.bloques.fibrocemento, color: BRAND.productos.fibro },
  ];

  return (
    <div className="space-y-6">
      <PageHeader versionId={id} versionNombre={version.nombre} />

      {/* Selector de período */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-4 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">Período</span>
        <div className="flex flex-wrap gap-1.5">
          {periodos.map(per => {
            const activo = per === periodoSel;
            return (
              <Link
                key={per}
                href={`/versiones/${id}/costo-arrastrado?periodo=${per}`}
                className="text-sm px-3 py-1.5 rounded-lg transition-colors tabular-nums"
                style={{
                  backgroundColor: activo ? BRAND.primary : BRAND.bgBand,
                  color: activo ? "#fff" : "#475569",
                }}
              >
                {formatMes(per)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* KPIs resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {bloqueList.map(({ key, bloque, color }) => (
          <div
            key={key}
            className="bg-white rounded-xl shadow-sm p-4 border border-slate-200"
            style={{ borderTop: `4px solid ${color}` }}
          >
            <p className="text-xs uppercase tracking-wide text-slate-500 truncate">{bloque.nombre}</p>
            <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
              {formatCOP(bloque.total_costo)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">COP/Ton</p>
          </div>
        ))}
      </div>

      {/* Tablas por bloque */}
      {bloqueList.map(({ key, bloque, color }) => (
        <BloqueTabla key={key} bloque={bloque} color={color} />
      ))}

      <p className="text-xs text-slate-400 italic">
        Columna Real: pendiente integración costos_reales.
        Los totales del Bloque Clinker incluyen Crudo explotado × factor de consumo ({data.consumo_crudo_en_clinker.toFixed(4)} ton/ton).
      </p>
    </div>
  );
}

function BloqueTabla({ bloque, color }: { bloque: BloqueResult; color: string }) {
  const UMBRAL_DIFF = 0.05; // 5% — usado cuando Real esté disponible

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="px-6 py-3 flex items-center gap-3"
        style={{ borderLeft: `4px solid ${color}`, backgroundColor: BRAND.bgBand }}
      >
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
          ORD {bloque.ord}
        </span>
        <h2 className="text-base font-semibold text-slate-900">{bloque.nombre}</h2>
        <span className="ml-auto text-sm font-bold text-slate-700 tabular-nums">
          Total: {formatCOP(bloque.total_costo)} /Ton
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND.bgSubtle }} className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-700 w-48">Componente</th>
              <th className="px-3 py-2.5 text-left font-semibold text-slate-500 text-xs uppercase">Tipo</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">Consumo Ppto</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">Costo Unit Ppto</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-700">Aporte Ppto</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-400">Consumo Real</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-400">Costo Unit Real</th>
              <th className="px-3 py-2.5 text-right font-semibold text-slate-400">Aporte Real</th>
            </tr>
          </thead>
          <tbody>
            {bloque.componentes.map((c, idx) => {
              const isSubrow = c.bloque_origen === "crudo";
              return (
                <tr
                  key={idx}
                  className="border-b border-slate-100"
                  style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}
                >
                  <td className="px-4 py-2 text-slate-900">
                    {isSubrow && (
                      <span className="text-slate-300 mr-2">↳</span>
                    )}
                    <span className={isSubrow ? "text-slate-600" : "font-medium"}>{c.nombre}</span>
                  </td>
                  <td className="px-3 py-2">
                    <TipoBadge tipo={c.tipo} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {formatConsumo(c.consumo, c.tipo)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {c.costo_unit > 0 ? formatCOP(c.costo_unit) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                    {c.total > 0 ? formatCOP(c.total) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">—</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">—</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">—</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: BRAND.primarySoft }} className="border-t-2 border-slate-300">
              <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
                Total
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-900">
                {formatCOP(bloque.total_costo)}
              </td>
              <td colSpan={3} className="px-3 py-2.5 text-right text-slate-400 text-xs">Real pendiente</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    mp_directo: { bg: BRAND.primarySoft, text: BRAND.primary, label: "MP" },
    mp_derivado: { bg: BRAND.bgBand, text: BRAND.inkSecondary, label: "Cascada" },
    termico:    { bg: BRAND.accentSoft, text: BRAND.accent, label: "Combust." },
    energia:    { bg: "#FEF3C7", text: "#D97706", label: "Energía" },
    fijo:       { bg: "#F3F4F6", text: "#6B7280", label: "Fijo" },
  };
  const s = styles[tipo] ?? styles.fijo;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function formatConsumo(consumo: number, tipo: string): React.ReactNode {
  if (consumo === 0) return <span className="text-slate-300">—</span>;
  if (tipo === "fijo") return "1";
  if (tipo === "energia") return `${consumo.toFixed(2)} kWh/Ton`;
  return consumo.toFixed(4);
}

function PageHeader({ versionId, versionNombre }: { versionId: string; versionNombre: string }) {
  return (
    <div>
      <nav className="text-xs text-slate-500 mb-3 flex items-center gap-1">
        <Link href="/versiones" className="hover:underline hover:text-slate-700">Versiones</Link>
        <span>/</span>
        <Link href={`/versiones/${versionId}`} className="hover:underline hover:text-slate-700">{versionNombre}</Link>
        <span>/</span>
        <span className="font-medium text-slate-800">Costo arrastrado</span>
      </nav>
      <header className="flex items-start justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Costo Arrastrado</h1>
          <p className="text-sm text-slate-500 mt-1">
            Desglose por componente de los 4 procesos finales — Clinker con Crudo explotado
          </p>
        </div>
        <Link
          href={`/versiones/${versionId}/costo`}
          className="text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          Volver a matriz
        </Link>
      </header>
    </div>
  );
}

function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-12 text-center">
      <p className="text-sm text-slate-500">{mensaje}</p>
    </div>
  );
}

// ─── Data fetching (mirrors API route logic) ─────────────────────────────────

async function fetchCostoArrastrado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  versionId: string,
  runId: string,
  periodo: string,
): Promise<CostoArrastradoData | null> {
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", [3, 5, 6, 7, 16])
    .eq("activo", true);
  if (!procesos || procesos.length === 0) return null;

  const byOrd = new Map(procesos.map((p: { ord: number; id: string; nombre: string }) => [p.ord, p]));
  const procesoIds = procesos.map((p: { id: string }) => p.id);

  const LOG_TIPOS_ARR = [
    "precio_componente_directo",
    "precio_componente_derivado",
    "costo_componente_derivado_termico",
    "costo_energia_proceso",
    "costo_fijo_proceso",
  ];

  const [{ data: logs }, { data: recetas }] = await Promise.all([
    supabase
      .from("calculation_log")
      .select("id, calculo_tipo, proceso_id, material_id, concepto, valor_resultado, parametros_entrada")
      .eq("run_id", runId)
      .eq("periodo", periodo)
      .in("proceso_id", procesoIds)
      .in("calculo_tipo", LOG_TIPOS_ARR),
    supabase
      .from("recetas")
      .select("proceso_id, periodo, receta_lineas(material_id, porcentaje)")
      .eq("version_id", versionId)
      .in("proceso_id", procesoIds),
  ]);

  const pctByKey = new Map<string, number>();
  for (const r of (recetas ?? []) as Array<{ proceso_id: string; periodo: string; receta_lineas: Array<{ material_id: string; porcentaje: number }> }>) {
    const isPeriodo = r.periodo === periodo;
    for (const ln of r.receta_lineas ?? []) {
      const key = `${r.proceso_id}|${ln.material_id}`;
      if (isPeriodo || !pctByKey.has(key)) pctByKey.set(key, Number(ln.porcentaje));
    }
  }

  const matIds = Array.from(new Set((logs ?? []).map((l: { material_id: string | null }) => l.material_id).filter(Boolean))) as string[];
  const { data: materiales } = matIds.length > 0
    ? await supabase.from("materiales").select("id, nombre").in("id", matIds)
    : { data: [] };
  const matNombre = new Map<string, string>();
  for (const m of materiales ?? []) matNombre.set(m.id, m.nombre);

  type LogRow = { id: string; calculo_tipo: string; proceso_id: string; material_id: string | null; concepto: string | null; valor_resultado: number; parametros_entrada: Record<string, unknown> | null };

  const logsByProceso = new Map<string, LogRow[]>();
  for (const log of (logs ?? []) as LogRow[]) {
    if (!logsByProceso.has(log.proceso_id)) logsByProceso.set(log.proceso_id, []);
    logsByProceso.get(log.proceso_id)!.push(log);
  }

  function buildComp(log: LogRow, consumoOverride?: number): ComponenteBloque | null {
    const p = (log.parametros_entrada ?? {}) as Record<string, unknown>;
    if (log.calculo_tipo === "precio_componente_directo" || log.calculo_tipo === "precio_componente_derivado") {
      const consumo = consumoOverride ?? (log.material_id ? (pctByKey.get(`${log.proceso_id}|${log.material_id}`) ?? 0) : 0);
      const costoUnit = Number(log.valor_resultado);
      return { nombre: log.material_id ? (matNombre.get(log.material_id) ?? log.concepto ?? "") : (log.concepto ?? ""), tipo: log.calculo_tipo === "precio_componente_directo" ? "mp_directo" : "mp_derivado", consumo, costo_unit: costoUnit, total: consumo * costoUnit, real: null };
    }
    if (log.calculo_tipo === "costo_componente_derivado_termico") {
      const consumo = consumoOverride ?? Number(p.consumo ?? 0);
      const costoUnit = Number(p.precio_arrastrado ?? 0);
      return { nombre: log.material_id ? (matNombre.get(log.material_id) ?? log.concepto ?? "") : (log.concepto ?? ""), tipo: "termico", consumo, costo_unit: costoUnit, total: Number(log.valor_resultado), real: null };
    }
    if (log.calculo_tipo === "costo_energia_proceso") {
      const consumo = Number(p.kwh_ton ?? 0);
      const costoTotal = Number(log.valor_resultado);
      return { nombre: "Energía Eléctrica", tipo: "energia", consumo, costo_unit: consumo > 0 ? costoTotal / consumo : 0, total: costoTotal, real: null };
    }
    if (log.calculo_tipo === "costo_fijo_proceso") {
      const val = Number(log.valor_resultado);
      if (val === 0) return null;
      return { nombre: String(p.codigo ?? log.concepto ?? "Costo fijo"), tipo: "fijo", consumo: 1, costo_unit: val, total: val, real: null };
    }
    return null;
  }

  // Clinker block
  const proc3 = byOrd.get(3) as { id: string; ord: number; nombre: string } | undefined;
  const proc5 = byOrd.get(5) as { id: string; ord: number; nombre: string } | undefined;
  const logs5 = logsByProceso.get(proc5?.id ?? "") ?? [];
  const crudoDerivadoLog = logs5.find((l: LogRow) => l.calculo_tipo === "precio_componente_derivado");
  const crudoMatId = crudoDerivadoLog?.material_id ?? null;
  const consumo_crudo = crudoMatId ? (pctByKey.get(`${proc5!.id}|${crudoMatId}`) ?? 0) : 0;

  const clinkerComps: ComponenteBloque[] = [];
  if (proc3 && consumo_crudo > 0) {
    for (const log of logsByProceso.get(proc3.id) ?? []) {
      const comp = buildComp(log);
      if (!comp) continue;
      const cs = comp.consumo * consumo_crudo;
      clinkerComps.push({ ...comp, consumo: cs, total: cs * comp.costo_unit, bloque_origen: "crudo" });
    }
  }
  for (const log of logs5) {
    if (log.calculo_tipo === "precio_componente_derivado") continue;
    const comp = buildComp(log);
    if (comp) clinkerComps.push({ ...comp, bloque_origen: "clinker" });
  }

  function buildSimple(ord: number): BloqueResult {
    const proc = byOrd.get(ord) as { id: string; ord: number; nombre: string } | undefined;
    const comps: ComponenteBloque[] = [];
    if (proc) for (const log of logsByProceso.get(proc.id) ?? []) { const c = buildComp(log); if (c) comps.push(c); }
    return { ord, nombre: proc?.nombre ?? `ORD ${ord}`, componentes: comps, total_costo: comps.reduce((s, c) => s + c.total, 0) };
  }

  return {
    version_id: versionId,
    periodo,
    consumo_crudo_en_clinker: consumo_crudo,
    bloques: {
      clinker: { ord: 5, nombre: proc5?.nombre ?? "Clinkerización", componentes: clinkerComps, total_costo: clinkerComps.reduce((s, c) => s + c.total, 0) },
      cemento_ug: buildSimple(6),
      cemento_art: buildSimple(7),
      fibrocemento: buildSimple(16),
    },
  };
}
