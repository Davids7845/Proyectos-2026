// Vista Desviaciones — Presupuesto vs Real por proceso × material.
// Filtros: año + mes (URL search params). Sin filtro muestra todos los
// períodos disponibles en costos_reales.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import DesviacionesFilters from "./DesviacionesFilters";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ año?: string; mes?: string }>;
}

const MES_LABEL: Record<string, string> = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril",
  "05":"Mayo","06":"Junio","07":"Julio","08":"Agosto",
  "09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre",
};

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return "—";
  return n.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pctClass(p: number | null | undefined) {
  if (p == null) return "text-gray-400";
  if (p >  0.05) return "text-red-600 font-semibold";
  if (p < -0.05) return "text-green-600 font-semibold";
  return "text-gray-700";
}

export default async function DesviacionesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const filterAño = sp.año ?? "";
  const filterMes = sp.mes ?? "";

  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, periodo_inicio, periodo_fin")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // Períodos con datos reales (+ origen agregado por período)
  const { data: periodosReales } = await (supabase as any)
    .from("costos_reales")
    .select("periodo, origen")
    .eq("version_id", id);

  const periodosSet: string[] = Array.from(
    new Set(((periodosReales ?? []) as any[]).map((r: any) => r.periodo as string))
  ).sort();

  // Origen por período: si todas las filas son del mismo origen → 'excel' | 'calc';
  // si hay mezcla → 'mixto'. (Tras los fixes idempotentes esto no debería ocurrir.)
  const origenByPeriodo = new Map<string, "excel" | "calc" | "mixto">();
  for (const r of (periodosReales ?? []) as Array<{ periodo: string; origen: string }>) {
    const cur = origenByPeriodo.get(r.periodo);
    if (!cur) origenByPeriodo.set(r.periodo, r.origen as "excel" | "calc");
    else if (cur !== r.origen) origenByPeriodo.set(r.periodo, "mixto");
  }

  const años = Array.from(new Set(periodosSet.map(p => Number(p.slice(0, 4))))).sort();
  const meses = Array.from(
    new Set(periodosSet.map(p => p.slice(5, 7)))
  ).sort().map(m => ({ value: m, label: MES_LABEL[m] ?? m }));

  // Construir filtro de períodos
  const periodosFiltered = periodosSet.filter(p => {
    if (filterAño && !p.startsWith(filterAño)) return false;
    if (filterMes && p.slice(5, 7) !== filterMes) return false;
    return true;
  });

  // Obtener datos de desviaciones
  type DesvRow = {
    periodo: string;
    proceso_id: string;
    material_id: string | null;
    valor_ppto: number | null;
    valor_real: number | null;
    delta_valor: number | null;
    delta_pct: number | null;
  };

  let desvQuery = (supabase as any)
    .from("v_desviaciones")
    .select("periodo, proceso_id, material_id, valor_ppto, valor_real, delta_valor, delta_pct")
    .eq("version_id", id)
    .order("periodo")
    .order("proceso_id");

  if (periodosFiltered.length > 0 && (filterAño || filterMes)) {
    desvQuery = desvQuery.in("periodo", periodosFiltered);
  }

  const { data: rawDesv } = await desvQuery;
  const desviaciones = (rawDesv ?? []) as DesvRow[];

  // Procesos y materiales para nombres
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .order("ord");
  const { data: materiales } = await supabase
    .from("materiales")
    .select("id, codigo, nombre");

  // Runs disponibles del motor (para opción "Usar como real")
  const { data: runs } = await supabase
    .from("calculation_runs")
    .select("id, iniciado_en, estado, total_calculos")
    .eq("version_id", id)
    .eq("estado", "completado")
    .order("iniciado_en", { ascending: false })
    .limit(20);

  const procMap = new Map((procesos ?? []).map(p => [p.id, p]));
  const matMap  = new Map((materiales ?? []).map(m => [m.id, m]));

  // Agrupar por proceso → filas con sus materiales
  type GrupoFila = {
    procesoid: string;
    procesoNombre: string;
    procesoOrd: number;
    filas: Array<{
      materialNombre: string;
      materialCodigo: string;
      ppto: number | null;
      real: number | null;
      delta: number | null;
      pct: number | null;
    }>;
    totalPpto: number;
    totalReal: number;
    totalDelta: number;
  };

  const grupos = new Map<string, GrupoFila>();
  for (const d of desviaciones) {
    if (!grupos.has(d.proceso_id)) {
      const proc = procMap.get(d.proceso_id);
      grupos.set(d.proceso_id, {
        procesoid: d.proceso_id,
        procesoNombre: proc?.nombre ?? d.proceso_id,
        procesoOrd: proc?.ord ?? 0,
        filas: [],
        totalPpto: 0,
        totalReal: 0,
        totalDelta: 0,
      });
    }
    const g = grupos.get(d.proceso_id)!;
    const mat = d.material_id ? matMap.get(d.material_id) : null;
    g.filas.push({
      materialNombre: mat?.nombre ?? (d.material_id ? d.material_id : "Sin material"),
      materialCodigo: mat?.codigo ?? "",
      ppto:  d.valor_ppto,
      real:  d.valor_real,
      delta: d.delta_valor,
      pct:   d.delta_pct,
    });
    g.totalPpto  += d.valor_ppto  ?? 0;
    g.totalReal  += d.valor_real  ?? 0;
    g.totalDelta += d.delta_valor ?? 0;
  }

  const gruposList = Array.from(grupos.values()).sort((a, b) => a.procesoOrd - b.procesoOrd);

  const sinDatos = periodosSet.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span>/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span>/</span>
        <span className="text-gray-900">Desviaciones</span>
      </nav>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Presupuesto vs Real</h1>
        <DesviacionesFilters
          años={años}
          meses={meses}
          runs={(runs ?? []).map((r: { id: string; iniciado_en: string; total_calculos: number | null }) => ({
            id: r.id,
            iniciado_en: r.iniciado_en,
            total_calculos: r.total_calculos ?? 0,
          }))}
          periodosCargados={periodosSet.map(p => ({
            periodo: p,
            origen: origenByPeriodo.get(p) ?? "excel",
          }))}
          currentAño={filterAño}
          currentMes={filterMes}
          versionId={id}
        />
      </div>

      {sinDatos ? (
        <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500 space-y-2">
          <p className="font-medium">No hay costos reales cargados para esta versión.</p>
          <p className="text-sm">
            Usa <em>Cargar costos reales desde Excel</em> (arriba) para importar el
            panel Real de la hoja Costo del archivo presupuesto.
          </p>
        </div>
      ) : gruposList.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Sin datos para el filtro seleccionado. Prueba otro año/mes o quita los filtros.
        </p>
      ) : (
        <div className="space-y-6">
          {gruposList.map(g => {
            const pctTotal = g.totalPpto !== 0
              ? (g.totalReal - g.totalPpto) / g.totalPpto
              : null;
            return (
              <section key={g.procesoid}>
                <div className="flex items-baseline gap-3 mb-1">
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                    ORD {g.procesoOrd} · {g.procesoNombre}
                  </h2>
                  <span className={`text-xs ${pctClass(pctTotal)}`}>
                    {pctTotal != null ? `${(pctTotal * 100).toFixed(1)}% desviación total` : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Material / Concepto</th>
                        <th className="text-right px-3 py-2 font-medium">Presupuesto</th>
                        <th className="text-right px-3 py-2 font-medium">Real</th>
                        <th className="text-right px-3 py-2 font-medium">Δ COP</th>
                        <th className="text-right px-3 py-2 font-medium">Δ %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {g.filas.map((f, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">
                            {f.materialNombre}
                            {f.materialCodigo && (
                              <span className="ml-1 text-gray-400">({f.materialCodigo})</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {fmt(f.ppto)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {fmt(f.real)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {fmt(f.delta)}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums ${pctClass(f.pct)}`}>
                            {f.pct != null ? `${(f.pct * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                      {/* Fila total del proceso */}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2 text-gray-700">Total {g.procesoNombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(g.totalPpto)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(g.totalReal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(g.totalDelta)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${pctClass(pctTotal)}`}>
                          {pctTotal != null ? `${(pctTotal * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
