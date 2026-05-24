import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import CostosCharts from "@/components/dashboard/CostosCharts";

export default async function DashboardPage({
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

  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id, estado, iniciado_en")
    .eq("version_id", id)
    .eq("estado", "exitoso")
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  let barData: Array<{ nombre: string; costo: number }> = [];
  let lineData: Array<{ periodo: string; ug?: number; art?: number }> = [];

  if (lastRun) {
    const { data: costos } = await supabase
      .from("costo_proceso")
      .select("periodo, costo_por_ton, proceso:procesos(ord, nombre)")
      .eq("run_id", lastRun.id);

    const rows = (costos ?? []) as Array<{
      periodo: string;
      costo_por_ton: number;
      proceso: { ord: number; nombre: string } | null;
    }>;

    // Último periodo disponible
    const periodos = Array.from(new Set(rows.map(r => r.periodo))).sort();
    const ultimoPeriodo = periodos[periodos.length - 1];

    if (ultimoPeriodo) {
      barData = rows
        .filter(r => r.periodo === ultimoPeriodo && r.proceso)
        .map(r => ({ nombre: r.proceso!.nombre, costo: Number(r.costo_por_ton) }))
        .sort((a, b) => {
          const rowA = rows.find(r => r.proceso?.nombre === a.nombre);
          const rowB = rows.find(r => r.proceso?.nombre === b.nombre);
          return (rowA?.proceso?.ord ?? 99) - (rowB?.proceso?.ord ?? 99);
        });
    }

    // Línea: ORD 6 = Cemento UG granel, ORD 7 = Cemento ART granel
    const byPeriodo = new Map<string, { ug?: number; art?: number }>();
    for (const r of rows) {
      if (!r.proceso) continue;
      const ord = r.proceso.ord;
      if (ord !== 6 && ord !== 7) continue;
      const cur = byPeriodo.get(r.periodo) ?? {};
      if (ord === 6) cur.ug = Number(r.costo_por_ton);
      if (ord === 7) cur.art = Number(r.costo_por_ton);
      byPeriodo.set(r.periodo, cur);
    }
    lineData = periodos.map(p => ({ periodo: p, ...byPeriodo.get(p) }));
  }

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Dashboard</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Estado: <strong>{version.estado}</strong>
            {lastRun && (
              <span className="ml-2">
                · Último run exitoso: {new Date(lastRun.iniciado_en).toLocaleString("es-CO")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/versiones/${id}/costo`}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:bg-gray-50 rounded px-3 py-1.5"
          >
            Ver costos
          </Link>
          <Link
            href={`/versiones/${id}/calcular`}
            className="text-sm text-white bg-green-600 hover:bg-green-700 rounded px-3 py-1.5"
          >
            Recalcular
          </Link>
        </div>
      </div>

      {!lastRun ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm mb-3">No hay cálculos exitosos para esta versión.</p>
          <Link
            href={`/versiones/${id}/calcular`}
            className="text-sm text-blue-600 hover:underline"
          >
            Ejecutar cálculo →
          </Link>
        </div>
      ) : (
        <CostosCharts barData={barData} lineData={lineData} />
      )}
    </div>
  );
}
