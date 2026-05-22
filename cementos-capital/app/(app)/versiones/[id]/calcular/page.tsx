import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import CalcularButton from "@/components/calc/CalcularButton";

export default async function CalcularPage({
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

  // Costos por proceso del último run
  let costos: Array<{ proceso: string; ord: number; periodo: string; costo_por_ton: number; costo_total: number }> = [];
  if (lastRun) {
    const { data } = await supabase
      .from("costo_proceso")
      .select("periodo, costo_total, costo_por_ton, proceso:procesos(nombre, ord)")
      .eq("run_id", lastRun.id)
      .order("periodo");
    costos = (data ?? []).map((r: any) => ({
      proceso: r.proceso?.nombre ?? "?",
      ord: r.proceso?.ord ?? 0,
      periodo: r.periodo,
      costo_por_ton: Number(r.costo_por_ton),
      costo_total: Number(r.costo_total),
    }));
  }

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Calcular</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Calcular presupuesto</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Estado actual: <strong>{version.estado}</strong>
          </p>
        </div>
        <CalcularButton versionId={id} estado={version.estado} />
      </div>

      {lastRun && (
        <section className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Último cálculo</h2>
          <dl className="text-sm text-gray-700 grid grid-cols-2 gap-x-6 gap-y-1">
            <dt className="text-gray-500">Estado</dt><dd>{lastRun.estado}</dd>
            <dt className="text-gray-500">Duración</dt><dd>{lastRun.duracion_ms ?? "—"} ms</dd>
            <dt className="text-gray-500">Total cálculos</dt><dd>{lastRun.total_calculos ?? 0}</dd>
            <dt className="text-gray-500">Iniciado</dt><dd>{new Date(lastRun.iniciado_en).toLocaleString("es-CO")}</dd>
            {lastRun.error_msg && (
              <>
                <dt className="text-red-600 col-span-2 font-medium mt-2">Error</dt>
                <dd className="col-span-2 text-red-700 text-xs">{lastRun.error_msg}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {costos.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Costo por proceso × periodo</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ORD</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Proceso</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Periodo</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Costo/Ton (COP)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Costo Total (COP)</th>
                </tr>
              </thead>
              <tbody>
                {costos.map((c, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{c.ord}</td>
                    <td className="px-3 py-2 text-gray-900">{c.proceso}</td>
                    <td className="px-3 py-2 text-gray-500 tabular-nums">{c.periodo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.costo_por_ton.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.costo_total.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
