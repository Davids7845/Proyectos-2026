// Matriz pivot proceso × periodo del último run de cálculo.
// Cada celda muestra el costo/Ton y enlaza al árbol de trazabilidad.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

interface CostoCell {
  costo_por_ton: number;
  costo_total: number;
  calc_total_id: string | null;
}

export default async function CostoPivotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // Último run para esta versión
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id, estado, iniciado_en, finalizado_en, duracion_ms, total_calculos, error_msg")
    .eq("version_id", id)
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Si no hay run aún, mostrar mensaje y enlace a /calcular
  if (!lastRun) {
    return (
      <div>
        <Breadcrumb versionNombre={version.nombre} />
        <Header versionId={id} estado={version.estado} />
        <EmptyState id={id} mensaje="Aún no se ha ejecutado ningún cálculo." />
      </div>
    );
  }

  // Cargar todos los costos del run con metadata del proceso
  const { data: costoRows } = await supabase
    .from("costo_proceso")
    .select("periodo, costo_total, costo_por_ton, calc_total_id, proceso:procesos(id, nombre, ord, orden_topologico)")
    .eq("run_id", lastRun.id);

  // Construir matriz pivot: { [procesoKey]: { proceso, byPeriodo: Map<periodo, CostoCell> } }
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

  const filas = Array.from(procesos.values()).sort((a, b) => a.orden_topologico - b.orden_topologico);
  const periodos = Array.from(periodosSet).sort();

  // Promedio por periodo (sólo de procesos calculados)
  const promedioPorPeriodo = new Map<string, number>();
  for (const per of periodos) {
    const vals = filas.map(f => f.byPeriodo.get(per)?.costo_por_ton).filter((v): v is number => v != null);
    if (vals.length > 0) promedioPorPeriodo.set(per, vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  return (
    <div>
      <Breadcrumb versionNombre={version.nombre} />
      <Header versionId={id} estado={version.estado} />

      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Último cálculo</h2>
        <dl className="text-sm text-gray-700 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
          <dt className="text-gray-500">Estado</dt><dd>{lastRun.estado}</dd>
          <dt className="text-gray-500">Duración</dt><dd>{lastRun.duracion_ms ?? "—"} ms</dd>
          <dt className="text-gray-500">Cálculos</dt><dd>{lastRun.total_calculos ?? 0}</dd>
          <dt className="text-gray-500">Iniciado</dt><dd>{new Date(lastRun.iniciado_en).toLocaleString("es-CO")}</dd>
        </dl>
        {lastRun.error_msg && (
          <p className="mt-2 text-xs text-red-700 font-medium">Error: {lastRun.error_msg}</p>
        )}
      </section>

      {filas.length === 0 ? (
        <EmptyState id={id} mensaje="El último run no produjo costos. Revisa los datos de entrada." />
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Matriz costo/Ton — proceso × periodo</h2>
            <p className="text-xs text-gray-500">{filas.length} procesos · {periodos.length} periodos · click en celda → árbol de trazabilidad</p>
          </div>
          <div className="overflow-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[14rem]">
                    Proceso
                  </th>
                  {periodos.map(per => (
                    <th key={per} className="px-3 py-2 text-right font-medium text-gray-600 tabular-nums whitespace-nowrap">
                      {formatPeriodoCorto(per)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.proceso_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900 sticky left-0 bg-white z-10 group-hover:bg-gray-50">
                      <span className="text-xs text-gray-400 mr-2">{f.ord}</span>
                      {f.nombre}
                    </td>
                    {periodos.map(per => {
                      const cell = f.byPeriodo.get(per);
                      if (!cell) {
                        return <td key={per} className="px-3 py-2 text-right text-gray-300 tabular-nums">—</td>;
                      }
                      return (
                        <td key={per} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {cell.calc_total_id ? (
                            <Link
                              href={`/versiones/${id}/calculos/${cell.calc_total_id}`}
                              className="text-gray-700 hover:text-blue-700 hover:underline"
                              title={`Total: ${cell.costo_total.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP`}
                            >
                              {formatCop(cell.costo_por_ton)}
                            </Link>
                          ) : (
                            <span className="text-gray-700">{formatCop(cell.costo_por_ton)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {promedioPorPeriodo.size > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-3 py-2 text-xs font-medium text-gray-600 sticky left-0 bg-gray-50 z-10">
                      Promedio
                    </td>
                    {periodos.map(per => (
                      <td key={per} className="px-3 py-2 text-right tabular-nums text-xs font-medium text-gray-600">
                        {promedioPorPeriodo.has(per) ? formatCop(promedioPorPeriodo.get(per)!) : "—"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Breadcrumb({ versionNombre }: { versionNombre: string }) {
  return (
    <nav className="text-xs text-gray-500 mb-2">
      <Link href="/versiones" className="hover:underline">Versiones</Link>
      <span className="mx-1">/</span>
      <span>{versionNombre}</span>
      <span className="mx-1">/</span>
      <span className="text-gray-700">Costo</span>
    </nav>
  );
}

function Header({ versionId, estado }: { versionId: string; estado: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Costo por proceso</h1>
        <p className="text-sm text-gray-500 mt-0.5">Estado de la versión: <strong>{estado}</strong></p>
      </div>
      <div className="flex gap-2">
        <Link
          href={`/versiones/${versionId}/datos/precios`}
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:bg-gray-50 rounded px-3 py-1.5"
        >
          Datos
        </Link>
        <Link
          href={`/versiones/${versionId}/calcular`}
          className="text-sm text-white bg-green-600 hover:bg-green-700 rounded px-3 py-1.5"
        >
          Recalcular
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ id, mensaje }: { id: string; mensaje: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
      <p className="text-gray-500 text-sm">{mensaje}</p>
      <Link
        href={`/versiones/${id}/calcular`}
        className="inline-block mt-3 text-sm text-blue-600 hover:underline"
      >
        Ir a calcular →
      </Link>
    </div>
  );
}

function formatCop(n: number): string {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function formatPeriodoCorto(periodo: string): string {
  // "2026-01-01" → "Ene 26"
  const d = new Date(periodo + "T00:00:00");
  return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}
