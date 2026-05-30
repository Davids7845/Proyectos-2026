import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calculator, RefreshCw } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import RecalcularMotorButton from "@/components/RecalcularMotorButton";
import { formatCOP, formatMes, BRAND } from "@/lib/ui/colors";
import { periodoIndexToFecha } from "@/lib/calc/motor/periodos";

interface CostoCell {
  costo_por_ton: number;
  costo_total: number;
  calc_total_id: string | null;
}

export default async function CostoPivotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ motor?: string }>;
}) {
  const { id } = await params;
  const { motor } = await searchParams;
  const modoMotorNuevo = motor === "nuevo";
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado, fecha_inicio, fecha_fin")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // ── Modo motor NUEVO (R6a): lee de costo_calculado en lugar de costo_proceso ──
  if (modoMotorNuevo) {
    return (
      <CostoMatrizMotorNuevo
        id={id}
        versionNombre={version.nombre}
        fechaInicio={version.fecha_inicio}
        supabase={supabase}
      />
    );
  }

  // Último run para esta versión
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id, estado, iniciado_en, finalizado_en, duracion_ms, total_calculos, error_msg, procesos_omitidos")
    .eq("version_id", id)
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastRun) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={version.nombre} />
        <EmptyState id={id} mensaje="Aún no se ha ejecutado ningún cálculo para esta versión." />
      </div>
    );
  }

  const { data: costoRows } = await supabase
    .from("costo_proceso")
    .select("periodo, costo_total, costo_por_ton, calc_total_id, proceso:procesos(id, nombre, ord, orden_topologico)")
    .eq("run_id", lastRun.id);

  interface ProcRow {
    proceso_id: string;
    ord: number;
    orden_topologico: number;
    nombre: string;
    byPeriodo: Map<string, CostoCell>;
  }
  const procesos = new Map<string, ProcRow>();
  const periodosSet = new Set<string>();

  for (const r of (costoRows ?? []) as any[]) {
    if (!r.proceso) continue;
    periodosSet.add(r.periodo);
    const key = r.proceso.id;
    if (!procesos.has(key)) {
      procesos.set(key, {
        proceso_id: r.proceso.id,
        ord: r.proceso.ord,
        orden_topologico: r.proceso.orden_topologico,
        nombre: r.proceso.nombre,
        byPeriodo: new Map(),
      });
    }
    procesos.get(key)!.byPeriodo.set(r.periodo, {
      costo_por_ton: Number(r.costo_por_ton),
      costo_total: Number(r.costo_total),
      calc_total_id: r.calc_total_id,
    });
  }

  // ── Fase 3: ORD 21 derivado (vista) — promedio ponderado de cementos finales ─
  const ORDS_CONSOLIDADOS = new Set([8, 9, 10, 11, 14, 16, 17, 18, 22]);
  const procesosArr = Array.from(procesos.values());
  const idsConsolidables: string[] = [];
  procesosArr.forEach(f => {
    if (ORDS_CONSOLIDADOS.has(f.ord)) idsConsolidables.push(f.proceso_id);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prodRows } = await (supabase as any)
    .from("produccion_venta_periodo")
    .select("proceso_id, periodo, toneladas")
    .eq("version_id", id)
    .in("proceso_id", idsConsolidables);
  const prodByKey = new Map<string, number>();
  for (const p of (prodRows ?? []) as Array<{ proceso_id: string; periodo: string; toneladas: number | null }>) {
    prodByKey.set(`${p.proceso_id}|${p.periodo}`, Number(p.toneladas ?? 0));
  }
  const ord21Por: Map<string, CostoCell> = new Map();
  Array.from(periodosSet).forEach(per => {
    let sumaCxP = 0;
    let sumaP = 0;
    procesosArr.forEach(f => {
      if (!ORDS_CONSOLIDADOS.has(f.ord)) return;
      const c = f.byPeriodo.get(per)?.costo_por_ton ?? 0;
      const p = prodByKey.get(`${f.proceso_id}|${per}`) ?? 0;
      sumaCxP += c * p;
      sumaP += p;
    });
    if (sumaP > 0) {
      ord21Por.set(per, { costo_por_ton: sumaCxP / sumaP, costo_total: sumaCxP, calc_total_id: null });
    }
  });
  // Si la versión tiene un registro de ORD 21 en `procesos`, lo añadimos como
  // fila derivada (sin link a árbol — calc_total_id null lo deshabilita).
  const procOrd21 = (await supabase
    .from("procesos")
    .select("id, nombre, orden_topologico")
    .eq("ord", 21)
    .maybeSingle()).data;
  if (procOrd21 && ord21Por.size > 0) {
    procesos.set(procOrd21.id, {
      proceso_id: procOrd21.id,
      ord: 21,
      orden_topologico: procOrd21.orden_topologico ?? 999,
      nombre: procOrd21.nombre ?? "Cementos consolidado",
      byPeriodo: ord21Por,
    });
  }

  const filas = Array.from(procesos.values()).sort((a, b) => a.orden_topologico - b.orden_topologico);
  const periodos = Array.from(periodosSet).sort();

  if (filas.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={version.nombre} />
        <EmptyState id={id} mensaje="El último cálculo no produjo costos. Revisa los datos de entrada." />
      </div>
    );
  }

  // ── KPIs ──────────────────────────────────────────────────────────────
  const ultimoPeriodo = periodos[periodos.length - 1];
  const penultimoPeriodo = periodos.length >= 2 ? periodos[periodos.length - 2] : null;

  // Promedio ponderado del último periodo
  const costosUltimo = filas
    .map(f => f.byPeriodo.get(ultimoPeriodo)?.costo_por_ton)
    .filter((v): v is number => v != null);
  const promedioUltimo = costosUltimo.length > 0
    ? costosUltimo.reduce((s, v) => s + v, 0) / costosUltimo.length
    : null;

  const costosPenultimo = penultimoPeriodo
    ? filas.map(f => f.byPeriodo.get(penultimoPeriodo)?.costo_por_ton).filter((v): v is number => v != null)
    : [];
  const promedioPenultimo = costosPenultimo.length > 0
    ? costosPenultimo.reduce((s, v) => s + v, 0) / costosPenultimo.length
    : null;

  const deltaProm = promedioUltimo != null && promedioPenultimo != null && promedioPenultimo > 0
    ? ((promedioUltimo - promedioPenultimo) / promedioPenultimo) * 100
    : null;

  // Proceso más costoso en el último periodo
  let maxProceso: { nombre: string; costo: number } | null = null;
  for (const f of filas) {
    const c = f.byPeriodo.get(ultimoPeriodo)?.costo_por_ton;
    if (c != null && (maxProceso == null || c > maxProceso.costo)) {
      maxProceso = { nombre: f.nombre, costo: c };
    }
  }

  // Mayor variación MoM
  let mayorVariacion: { nombre: string; delta: number; periodo: string } | null = null;
  if (penultimoPeriodo) {
    for (const f of filas) {
      const curr = f.byPeriodo.get(ultimoPeriodo)?.costo_por_ton;
      const prev = f.byPeriodo.get(penultimoPeriodo)?.costo_por_ton;
      if (curr != null && prev != null && prev > 0) {
        const delta = ((curr - prev) / prev) * 100;
        if (mayorVariacion == null || Math.abs(delta) > Math.abs(mayorVariacion.delta)) {
          mayorVariacion = { nombre: f.nombre, delta, periodo: ultimoPeriodo };
        }
      }
    }
  }

  // Promedio por periodo
  const promedioPorPeriodo = new Map<string, number>();
  for (const per of periodos) {
    const vals = filas.map(f => f.byPeriodo.get(per)?.costo_por_ton).filter((v): v is number => v != null);
    if (vals.length > 0) promedioPorPeriodo.set(per, vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  return (
    <div className="space-y-6">
      <PageHeader versionId={id} versionNombre={version.nombre} />

      {/* ── 4 KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Costo promedio"
          valor={promedioUltimo != null ? formatCOP(promedioUltimo) : "—"}
          unidad="/Ton"
          delta={deltaProm}
          deltaInverso
          sub={`${formatMes(ultimoPeriodo)}`}
        />
        <KpiCard
          label="Proceso más costoso"
          valor={maxProceso ? formatCOP(maxProceso.costo) : "—"}
          unidad="/Ton"
          sub={maxProceso?.nombre ?? "—"}
        />
        <KpiCard
          label="Mayor variación MoM"
          valor={mayorVariacion ? `${mayorVariacion.delta > 0 ? "+" : ""}${mayorVariacion.delta.toFixed(1)} %` : "—"}
          sub={mayorVariacion ? mayorVariacion.nombre : "Sin periodo anterior"}
          deltaRaw={mayorVariacion?.delta}
          deltaInverso
        />
        <KpiCard
          label="Procesos calculados"
          valor={String(filas.length)}
          sub={`${periodos.length} periodos`}
        />
      </div>

      {/* ── Info del run ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
          <span>
            <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Estado</span>
            <span className="font-medium text-slate-800">{lastRun.estado}</span>
          </span>
          <span>
            <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Duración</span>
            <span className="font-medium text-slate-800">{lastRun.duracion_ms != null ? `${lastRun.duracion_ms} ms` : "—"}</span>
          </span>
          <span>
            <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Cálculos</span>
            <span className="font-medium text-slate-800">{lastRun.total_calculos ?? 0}</span>
          </span>
          <span>
            <span className="text-xs uppercase tracking-wide text-slate-500 mr-2">Iniciado</span>
            <span className="font-medium text-slate-800">{new Date(lastRun.iniciado_en).toLocaleString("es-CO")}</span>
          </span>
        </div>
        {lastRun.error_msg && (
          <p className="mt-2 text-xs text-red-700 font-medium bg-red-50 rounded px-3 py-1.5">
            Error: {lastRun.error_msg}
          </p>
        )}
        {Array.isArray((lastRun as any).procesos_omitidos) && (lastRun as any).procesos_omitidos.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-amber-800 font-medium bg-amber-50 rounded px-3 py-1.5 cursor-pointer">
              {(lastRun as any).procesos_omitidos.length} procesos omitidos — click para ver razones
            </summary>
            <ul className="mt-2 text-xs text-amber-900 bg-amber-50/60 rounded px-3 py-2 space-y-0.5 max-h-48 overflow-auto font-mono">
              {((lastRun as any).procesos_omitidos as Array<{ ord: number; razon: string }>).map((o, i) => (
                <li key={i}>ORD {o.ord}: {o.razon}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* ── Matriz pivotada ──────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-baseline justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Matriz costo/Ton — proceso × periodo</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filas.length} procesos · {periodos.length} periodos · click en celda → árbol de trazabilidad
            </p>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND.bgBand }} className="border-b border-slate-200 sticky top-0">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 z-10 min-w-[16rem]"
                    style={{ backgroundColor: BRAND.bgBand }}>
                  Proceso
                </th>
                {periodos.map(per => (
                  <th key={per} className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {formatMes(per)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => (
                <tr
                  key={f.proceso_id}
                  className="border-b border-slate-100 transition-colors hover:bg-blue-50/40"
                  style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}
                >
                  <td
                    className="px-4 py-2.5 text-slate-900 sticky left-0 z-10"
                    style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}
                  >
                    <span className="text-xs text-slate-400 mr-2 tabular-nums">{String(f.ord).padStart(2, "0")}</span>
                    <Link
                      href={f.ord === 21
                        ? `/versiones/${id}/cementos-consolidado`
                        : `/versiones/${id}/costo/proceso/${f.ord}`}
                      className="hover:underline font-medium"
                      style={{ color: BRAND.primary }}
                    >
                      {f.nombre}
                    </Link>
                    {f.ord === 21 && (
                      <span
                        className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: BRAND.primarySoft, color: BRAND.primaryDark }}
                        title="Vista derivada — promedio ponderado de los 9 cementos finales"
                      >
                        Derivado
                      </span>
                    )}
                  </td>
                  {periodos.map(per => {
                    const cell = f.byPeriodo.get(per);
                    if (!cell) {
                      return (
                        <td key={per} className="px-3 py-2.5 text-right text-slate-300 tabular-nums">—</td>
                      );
                    }
                    return (
                      <td key={per} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {cell.calc_total_id ? (
                          <Link
                            href={`/versiones/${id}/calculos/${cell.calc_total_id}`}
                            className="text-slate-700 hover:underline"
                            title={`Total: ${cell.costo_total.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP`}
                          >
                            {formatCOP(cell.costo_por_ton)}
                          </Link>
                        ) : (
                          <span className="text-slate-700">{formatCOP(cell.costo_por_ton)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {promedioPorPeriodo.size > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: BRAND.primarySoft }} className="border-t-2 border-slate-300">
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-700 sticky left-0 z-10 uppercase tracking-wide"
                      style={{ backgroundColor: BRAND.primarySoft }}>
                    Promedio
                  </td>
                  {periodos.map(per => (
                    <td key={per} className="px-3 py-2.5 text-right tabular-nums text-xs font-bold text-slate-700">
                      {promedioPorPeriodo.has(per) ? formatCOP(promedioPorPeriodo.get(per)!) : "—"}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Componentes ───────────────────────────────────────────────────────

function PageHeader({
  versionId,
  versionNombre,
  modo = "viejo",
}: {
  versionId: string;
  versionNombre: string;
  modo?: "viejo" | "nuevo";
}) {
  return (
    <div>
      <nav className="text-xs text-slate-500 mb-3 flex items-center gap-1">
        <Link href="/versiones" className="hover:underline hover:text-slate-700">Versiones</Link>
        <span>/</span>
        <span className="text-slate-700">{versionNombre}</span>
        <span>/</span>
        <span className="font-medium text-slate-800">Costo</span>
      </nav>
      <header className="flex items-start justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Costo por proceso</h1>
          <p className="text-sm text-slate-500 mt-1">Matriz costo unitario (COP/Ton) por proceso y período</p>
        </div>
        <div className="flex flex-col items-end gap-2 mt-1">
          <div className="flex gap-2">
            <Link
              href={`/versiones/${versionId}/datos/precios`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              Datos
            </Link>
            <ExportButton versionId={versionId} />
            <Link
              href={`/versiones/${versionId}/calcular`}
              className="inline-flex items-center gap-1.5 text-sm text-white rounded-lg px-3 py-1.5 transition-colors"
              style={{ backgroundColor: BRAND.success }}
            >
              <RefreshCw size={14} />
              Recalcular
            </Link>
          </div>
          {/* ── Toggle motor viejo/nuevo (temporal R6a) ── */}
          <div className="flex items-center gap-2">
            <RecalcularMotorButton versionId={versionId} />
            <div className="inline-flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: BRAND.border }}>
              <Link
                href={`/versiones/${versionId}/costo`}
                className="px-3 py-1.5 font-medium transition-colors"
                style={modo === "viejo"
                  ? { backgroundColor: BRAND.primary, color: "white" }
                  : { color: BRAND.inkSecondary }}
              >
                Motor viejo
              </Link>
              <Link
                href={`/versiones/${versionId}/costo?motor=nuevo`}
                className="px-3 py-1.5 font-medium transition-colors border-l"
                style={modo === "nuevo"
                  ? { backgroundColor: BRAND.primary, color: "white", borderColor: BRAND.border }
                  : { color: BRAND.inkSecondary, borderColor: BRAND.border }}
              >
                Motor nuevo
              </Link>
            </div>
            <Link
              href={`/versiones/${versionId}/comparar-motores`}
              className="text-xs underline"
              style={{ color: BRAND.primary }}
            >
              Comparar
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}

function KpiCard({
  label,
  valor,
  unidad,
  sub,
  delta,
  deltaRaw,
  deltaInverso = false,
}: {
  label: string;
  valor: string;
  unidad?: string;
  sub?: string;
  delta?: number | null;
  deltaRaw?: number | null;
  deltaInverso?: boolean;
}) {
  const d = delta ?? deltaRaw;
  const deltaColor = d == null ? BRAND.inkMuted
    : deltaInverso
      ? (d > 0 ? BRAND.danger : BRAND.success)
      : (d > 0 ? BRAND.success : BRAND.danger);

  return (
    <div
      className="bg-white rounded-xl shadow-sm p-5 border border-slate-200"
      style={{ borderTop: `4px solid ${BRAND.primary}` }}
    >
      <p className="text-xs uppercase tracking-wide font-medium mb-2" style={{ color: BRAND.inkMuted }}>
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: BRAND.ink }}>
        {valor}
        {unidad && <span className="text-sm font-normal ml-1 text-slate-500">{unidad}</span>}
      </p>
      {(d != null || sub) && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {d != null && (
            <span className="text-xs font-semibold tabular-nums" style={{ color: deltaColor }}>
              {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} %
            </span>
          )}
          {sub && <span className="text-xs text-slate-500 truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function EmptyState({ id, mensaje }: { id: string; mensaje: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-16 text-center">
      <div className="flex justify-center mb-4">
        <Calculator size={48} className="text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin resultados de cálculo</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">{mensaje}</p>
      <Link
        href={`/versiones/${id}/calcular`}
        className="inline-flex items-center gap-2 text-sm text-white rounded-lg px-4 py-2 transition-colors"
        style={{ backgroundColor: BRAND.primary }}
      >
        <RefreshCw size={14} />
        Ejecutar cálculo →
      </Link>
    </div>
  );
}

// ── Matriz desde el MOTOR NUEVO (R6a) — lee de costo_calculado ───────────────
async function CostoMatrizMotorNuevo({
  id,
  versionNombre,
  fechaInicio,
  supabase,
}: {
  id: string;
  versionNombre: string;
  fechaInicio: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  // Totales por proceso × período del motor nuevo
  const { data: totales } = await supabase
    .from("costo_calculado")
    .select("ord, periodo, aporte_por_ton")
    .eq("version_id", id)
    .eq("es_total", true)
    .order("ord");

  const rows = (totales ?? []) as Array<{ ord: number; periodo: number; aporte_por_ton: number }>;

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={versionNombre} modo="nuevo" />
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-sm text-amber-900">
            El motor nuevo todavía no tiene cálculos persistidos para esta versión.
          </p>
          <p className="text-xs text-amber-700 mt-2">
            Pulsa <strong>“Recalcular motor nuevo”</strong> arriba para poblar <code>costo_calculado</code>.
          </p>
        </div>
      </div>
    );
  }

  // Nombres de proceso por ord
  const ordsSet = Array.from(new Set(rows.map(r => r.ord)));
  const { data: procRows } = await supabase
    .from("procesos")
    .select("ord, nombre, orden_topologico")
    .in("ord", ordsSet);
  const nombrePorOrd = new Map<number, { nombre: string; orden: number }>();
  for (const p of (procRows ?? []) as Array<{ ord: number; nombre: string; orden_topologico: number | null }>) {
    nombrePorOrd.set(p.ord, { nombre: p.nombre, orden: p.orden_topologico ?? p.ord });
  }

  // Pivote ord → periodo → aporte
  const periodosSet = new Set<number>();
  const porOrd = new Map<number, Map<number, number>>();
  for (const r of rows) {
    periodosSet.add(r.periodo);
    if (!porOrd.has(r.ord)) porOrd.set(r.ord, new Map());
    porOrd.get(r.ord)!.set(r.periodo, Number(r.aporte_por_ton));
  }
  const periodos = Array.from(periodosSet).sort((a, b) => a - b);
  const filas = Array.from(porOrd.keys())
    .map(ord => ({
      ord,
      nombre: nombrePorOrd.get(ord)?.nombre ?? `ORD ${ord}`,
      orden: nombrePorOrd.get(ord)?.orden ?? ord,
      byPeriodo: porOrd.get(ord)!,
    }))
    .sort((a, b) => a.orden - b.orden);

  const fechaDe = (per: number) => (fechaInicio ? periodoIndexToFecha(fechaInicio, per) : `P${per}`);

  return (
    <div className="space-y-6">
      <PageHeader versionId={id} versionNombre={versionNombre} modo="nuevo" />

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-900">
        Mostrando <strong>motor de fórmulas nuevo</strong> (tabla <code>costo_calculado</code>).
        Vista temporal de verificación R6a — las calculadoras viejas siguen intactas.
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Matriz costo/Ton — motor nuevo</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filas.length} procesos · {periodos.length} periodos · click en proceso → desglose del motor nuevo
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND.bgBand }} className="border-b border-slate-200 sticky top-0">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 sticky left-0 z-10 min-w-[16rem]"
                    style={{ backgroundColor: BRAND.bgBand }}>
                  Proceso
                </th>
                {periodos.map(per => (
                  <th key={per} className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                    {fechaInicio ? formatMes(fechaDe(per)) : `P${per}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => (
                <tr
                  key={f.ord}
                  className="border-b border-slate-100 transition-colors hover:bg-blue-50/40"
                  style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}
                >
                  <td className="px-4 py-2.5 text-slate-900 sticky left-0 z-10"
                      style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}>
                    <span className="text-xs text-slate-400 mr-2 tabular-nums">{String(f.ord).padStart(2, "0")}</span>
                    <Link
                      href={`/versiones/${id}/costo/proceso/${f.ord}?motor=nuevo`}
                      className="hover:underline font-medium"
                      style={{ color: BRAND.primary }}
                    >
                      {f.nombre}
                    </Link>
                  </td>
                  {periodos.map(per => {
                    const v = f.byPeriodo.get(per);
                    return (
                      <td key={per} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700">
                        {v != null ? formatCOP(v) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
