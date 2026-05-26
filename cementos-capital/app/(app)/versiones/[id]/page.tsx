import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

const ESTADO_BADGE: Record<string, string> = {
  borrador:   "bg-gray-100 text-gray-700",
  calculando: "bg-yellow-100 text-yellow-700",
  calculado:  "bg-green-100 text-green-700",
  congelado:  "bg-blue-100 text-blue-700",
  archivado:  "bg-red-100 text-red-700",
};

function fmtPeriodo(p: string) {
  return new Date(p).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

function fmtCop(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export default async function VersionOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, descripcion, estado, periodo_inicio, periodo_fin, sap_enabled, creado_en")
    .eq("id", id)
    .single();
  if (!version) notFound();

  const [
    { count: nPrecios },
    { count: nRecetas },
    { count: nRecetaLineas },
    { data: lastRun },
    { count: nProcesosActivos },
  ] = await Promise.all([
    supabase.from("precios_insumos").select("id", { count: "exact", head: true }).eq("version_id", id),
    supabase.from("recetas").select("id", { count: "exact", head: true }).eq("version_id", id),
    supabase.from("receta_lineas").select("id, recetas!inner(version_id)", { count: "exact", head: true }).eq("recetas.version_id", id),
    supabase
      .from("calculation_runs")
      .select("id, estado, iniciado_en, finalizado_en, duracion_ms, total_calculos, error_msg")
      .eq("version_id", id)
      .order("iniciado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("procesos").select("id", { count: "exact", head: true }).eq("activo", true),
  ]);

  let topProcesos: Array<{ ord: number; nombre: string; promedio: number }> = [];
  if (lastRun) {
    const { data: costos } = await supabase
      .from("costo_proceso")
      .select("costo_por_ton, proceso:procesos(ord, nombre)")
      .eq("run_id", lastRun.id);
    const agg = new Map<string, { ord: number; nombre: string; sum: number; n: number }>();
    for (const r of (costos ?? []) as any[]) {
      const ord = r.proceso?.ord ?? 0;
      const nombre = r.proceso?.nombre ?? "?";
      const key = `${ord}|${nombre}`;
      const cur = agg.get(key) ?? { ord, nombre, sum: 0, n: 0 };
      cur.sum += Number(r.costo_por_ton);
      cur.n += 1;
      agg.set(key, cur);
    }
    topProcesos = Array.from(agg.values())
      .map(a => ({ ord: a.ord, nombre: a.nombre, promedio: a.n > 0 ? a.sum / a.n : 0 }))
      .sort((a, b) => a.ord - b.ord);
  }

  const estadoBadge = ESTADO_BADGE[version.estado] ?? "bg-gray-100 text-gray-700";
  const haveData = (nPrecios ?? 0) > 0 || (nRecetas ?? 0) > 0;

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">{version.nombre}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold text-gray-900">{version.nombre}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${estadoBadge}`}>
              {version.estado}
            </span>
          </div>
          {version.descripcion && (
            <p className="text-sm text-gray-500">{version.descripcion}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {fmtPeriodo(version.periodo_inicio)} – {fmtPeriodo(version.periodo_fin)}
            {version.sap_enabled && <span className="ml-2">· SAP</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/versiones/${id}/dashboard`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Dashboard
          </Link>
          {version.sap_enabled && (
            <Link
              href={`/versiones/${id}/base`}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Base SAP
            </Link>
          )}
          <Link
            href={`/versiones/${id}/desviaciones`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Desviaciones
          </Link>
          <Link
            href={`/versiones/${id}/datos/precios`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Editar datos
          </Link>
          <Link
            href={`/versiones/${id}/calcular`}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Calcular
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Metric label="Precios" value={nPrecios ?? 0} href={`/versiones/${id}/datos/precios`} />
        <Metric label="Recetas" value={nRecetas ?? 0} href={`/versiones/${id}/datos/recetas`} hint={`${nRecetaLineas ?? 0} líneas`} />
        <Metric label="Procesos activos" value={nProcesosActivos ?? 0} href={`/admin/maestros/procesos`} />
        <Metric label="Cálculos" value={lastRun?.total_calculos ?? 0} href={`/versiones/${id}/calcular`} hint={lastRun ? lastRun.estado : "sin ejecutar"} />
      </div>

      {!haveData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-blue-900 mb-1">Esta versión está vacía</h2>
          <p className="text-sm text-blue-800 mb-3">
            Importa la plantilla Excel o ingresa precios y recetas manualmente para empezar.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/versiones/${id}/datos/importar`}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Importar Excel
            </Link>
            <Link
              href={`/versiones/${id}/datos/precios`}
              className="px-3 py-1.5 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
            >
              Editar precios
            </Link>
          </div>
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Último cálculo</h2>
          {lastRun && (
            <Link href={`/versiones/${id}/calcular`} className="text-xs text-blue-600 hover:underline">
              ver detalle →
            </Link>
          )}
        </div>
        {!lastRun ? (
          <p className="text-sm text-gray-500">Aún no se ha ejecutado ningún cálculo.</p>
        ) : (
          <dl className="text-sm text-gray-700 grid grid-cols-4 gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs text-gray-500">Estado</dt>
              <dd className="font-medium">{lastRun.estado}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Duración</dt>
              <dd className="tabular-nums">{lastRun.duracion_ms ?? "—"} ms</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Total cálculos</dt>
              <dd className="tabular-nums">{lastRun.total_calculos ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Iniciado</dt>
              <dd>{new Date(lastRun.iniciado_en).toLocaleString("es-CO")}</dd>
            </div>
            {lastRun.error_msg && (
              <div className="col-span-4 bg-red-50 border border-red-200 rounded p-2 mt-2">
                <p className="text-xs font-medium text-red-700">Error</p>
                <p className="text-xs text-red-700 font-mono mt-0.5 break-all">{lastRun.error_msg}</p>
              </div>
            )}
          </dl>
        )}
      </section>

      {topProcesos.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Costo promedio por proceso (último run)</h2>
            <Link href={`/versiones/${id}/costo`} className="text-xs text-blue-600 hover:underline">
              ver pivote completo →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left font-medium py-1.5 w-12">ORD</th>
                <th className="text-left font-medium py-1.5">Proceso</th>
                <th className="text-right font-medium py-1.5">Promedio COP/Ton</th>
              </tr>
            </thead>
            <tbody>
              {topProcesos.map(p => (
                <tr key={`${p.ord}-${p.nombre}`} className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-500 tabular-nums">{p.ord}</td>
                  <td className="py-1.5 text-gray-900">{p.nombre}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtCop(p.promedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, hint, href }: { label: string; value: number; hint?: string; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-gray-900 tabular-nums mt-0.5">
        {value.toLocaleString("es-CO")}
      </p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </Link>
  );
}
