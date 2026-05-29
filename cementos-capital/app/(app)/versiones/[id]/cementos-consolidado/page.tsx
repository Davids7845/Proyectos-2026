// Vista derivada ORD 21 — Cementos consolidado.
//
// Promedio ponderado por producción de los 9 procesos finales de cemento.
// Los datos se calculan on-the-fly desde costo_proceso + produccion_venta_periodo.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCOP, formatMes, BRAND } from "@/lib/ui/colors";

const ORDS_CONSOLIDADOS = [8, 9, 10, 11, 14, 16, 17, 18, 22] as const;

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

export default async function CementosConsolidadoPage({
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

  // Procesos consolidables
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", ORDS_CONSOLIDADOS as unknown as number[])
    .eq("activo", true);

  if (!procesos || procesos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={version.nombre} />
        <EmptyState mensaje="No hay procesos finales de cemento configurados." />
      </div>
    );
  }
  const procesoIds = procesos.map(p => p.id);

  // Último run
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", id)
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Costos
  let costoQuery = supabase
    .from("costo_proceso")
    .select("proceso_id, periodo, costo_por_ton")
    .in("proceso_id", procesoIds);
  if (lastRun?.id) costoQuery = costoQuery.eq("run_id", lastRun.id);
  const { data: costos } = await costoQuery;

  // Producciones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: producciones } = await (supabase as any)
    .from("produccion_venta_periodo")
    .select("proceso_id, periodo, toneladas")
    .eq("version_id", id)
    .in("proceso_id", procesoIds);

  // Reunir períodos disponibles
  const periodosSet = new Set<string>();
  for (const c of costos ?? []) periodosSet.add(c.periodo);
  for (const p of (producciones ?? []) as Array<{ periodo: string }>) periodosSet.add(p.periodo);
  const periodos = Array.from(periodosSet).sort();

  if (periodos.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader versionId={id} versionNombre={version.nombre} />
        <EmptyState mensaje="Aún no hay cálculos para esta versión. Ejecuta primero el cálculo de la versión." />
      </div>
    );
  }

  // Período seleccionado: query param o último disponible
  const periodoSel = periodoParam && periodos.includes(periodoParam)
    ? periodoParam
    : periodos[periodos.length - 1];

  const costoByKey = new Map<string, number>();
  for (const c of costos ?? []) {
    costoByKey.set(`${c.proceso_id}|${c.periodo}`, Number(c.costo_por_ton));
  }
  const prodByKey = new Map<string, number>();
  for (const p of (producciones ?? []) as Array<{ proceso_id: string; periodo: string; toneladas: number | null }>) {
    prodByKey.set(`${p.proceso_id}|${p.periodo}`, Number(p.toneladas ?? 0));
  }

  // Calcular para todos los períodos (usado en barra superior + tabla actual)
  const resultados: PeriodoResult[] = periodos.map(periodo => {
    let sumaCostoPorProd = 0;
    let sumaProd = 0;
    const desgloseRaw: Array<Omit<DesgloseRow, "pct_total">> = [];
    for (const p of procesos) {
      const costo = costoByKey.get(`${p.id}|${periodo}`) ?? 0;
      const prod = prodByKey.get(`${p.id}|${periodo}`) ?? 0;
      const aporte = costo * prod;
      desgloseRaw.push({ ord: p.ord, nombre: p.nombre, costo_ton: costo, produccion_ton: prod, aporte });
      sumaCostoPorProd += aporte;
      sumaProd += prod;
    }
    const costoConsolidado = sumaProd > 0 ? sumaCostoPorProd / sumaProd : 0;
    return {
      periodo,
      desglose: desgloseRaw
        .sort((a, b) => a.ord - b.ord)
        .map(d => ({ ...d, pct_total: sumaCostoPorProd > 0 ? (d.aporte / sumaCostoPorProd) * 100 : 0 })),
      total_produccion: sumaProd,
      costo_consolidado_ton: costoConsolidado,
      costo_total_periodo: sumaCostoPorProd,
    };
  });

  const resultadoActual = resultados.find(r => r.periodo === periodoSel)!;

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
                href={`/versiones/${id}/cementos-consolidado?periodo=${per}`}
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Costo consolidado"
          valor={formatCOP(resultadoActual.costo_consolidado_ton)}
          unidad="/Ton"
          sub={`Período ${formatMes(periodoSel)}`}
          highlight
        />
        <KpiCard
          label="Producción total"
          valor={resultadoActual.total_produccion.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
          unidad="Ton"
          sub={`${resultadoActual.desglose.filter(d => d.produccion_ton > 0).length} procesos con producción`}
        />
        <KpiCard
          label="Costo total del período"
          valor={formatCOP(resultadoActual.costo_total_periodo)}
          unidad="COP"
          sub="Suma costo×producción"
        />
      </div>

      {/* Tabla de desglose */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Desglose por proceso</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Promedio ponderado: <span className="font-mono">Σ(costo<sub>i</sub> × prod<sub>i</sub>) / Σ(prod<sub>i</sub>)</span>
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND.bgBand }} className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Proceso</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">Costo/Ton</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">Producción (Ton)</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">Aporte ($)</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">% del total</th>
              </tr>
            </thead>
            <tbody>
              {resultadoActual.desglose.map((d, idx) => (
                <tr
                  key={d.ord}
                  className="border-b border-slate-100"
                  style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}
                >
                  <td className="px-4 py-2.5 text-slate-900">
                    <span className="text-xs text-slate-400 mr-2 tabular-nums">{String(d.ord).padStart(2, "0")}</span>
                    <Link
                      href={`/versiones/${id}/costo/proceso/${d.ord}`}
                      className="hover:underline font-medium"
                      style={{ color: BRAND.primary }}
                    >
                      {d.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {d.costo_ton > 0 ? formatCOP(d.costo_ton) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {d.produccion_ton > 0
                      ? d.produccion_ton.toLocaleString("es-CO", { maximumFractionDigits: 0 })
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {d.aporte > 0 ? formatCOP(d.aporte) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {d.pct_total > 0 ? `${d.pct_total.toFixed(1)} %` : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: BRAND.primarySoft }} className="border-t-2 border-slate-300">
                <td className="px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Consolidado
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-700">
                  {formatCOP(resultadoActual.costo_consolidado_ton)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-700">
                  {resultadoActual.total_produccion.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-700">
                  {formatCOP(resultadoActual.costo_total_periodo)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-slate-700">
                  100 %
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Serie temporal mensual */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Evolución mensual</h2>
          <p className="text-xs text-slate-500 mt-0.5">{resultados.length} período(s)</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: BRAND.bgBand }} className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Período</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">Costo consolidado /Ton</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-700">Producción Total Ton</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r, idx) => (
                <tr
                  key={r.periodo}
                  className="border-b border-slate-100"
                  style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}
                >
                  <td className="px-4 py-2.5 text-slate-900">
                    <Link
                      href={`/versiones/${id}/cementos-consolidado?periodo=${r.periodo}`}
                      className="hover:underline"
                      style={{ color: r.periodo === periodoSel ? BRAND.primary : "#475569", fontWeight: r.periodo === periodoSel ? 600 : 400 }}
                    >
                      {formatMes(r.periodo)}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.costo_consolidado_ton > 0 ? formatCOP(r.costo_consolidado_ton) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.total_produccion > 0
                      ? r.total_produccion.toLocaleString("es-CO", { maximumFractionDigits: 0 })
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ versionId, versionNombre }: { versionId: string; versionNombre: string }) {
  return (
    <div>
      <nav className="text-xs text-slate-500 mb-3 flex items-center gap-1">
        <Link href="/versiones" className="hover:underline hover:text-slate-700">Versiones</Link>
        <span>/</span>
        <Link href={`/versiones/${versionId}`} className="hover:underline hover:text-slate-700">{versionNombre}</Link>
        <span>/</span>
        <span className="font-medium text-slate-800">Cementos consolidado</span>
      </nav>
      <header className="flex items-start justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cementos consolidado (ORD 21)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vista derivada — promedio ponderado por producción de los 9 cementos finales
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

function KpiCard({
  label, valor, unidad, sub, highlight = false,
}: {
  label: string;
  valor: string;
  unidad?: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm p-5 border border-slate-200"
      style={{ borderTop: `4px solid ${highlight ? BRAND.primary : BRAND.primaryLight}` }}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
        {valor}
        {unidad && <span className="text-sm font-normal text-slate-500 ml-1">{unidad}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
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
