// Vista "Impacto de un insumo en productos finales" — Fase 2b Módulo 3.
// Trazabilidad hacia adelante: dado un material, muestra a qué productos
// finales contribuye y con cuánto COP/Ton de aporte.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

interface Aporte {
  proceso_id: string;
  ord: number;
  nombre_proceso: string;
  periodo: string;
  aporte_cop_ton: number;
  costo_proceso_cop_ton: number;
  pct_costo: number;
}

const FINAL_ORDS = [6, 7, 8, 9, 10, 11, 14, 15, 16, 19, 21];

function fmt(n: number, dec = 0): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPeriodo(p: string): string {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export default async function ImpactoPage({
  params,
}: {
  params: Promise<{ id: string; materialId: string }>;
}) {
  const { id: versionId, materialId } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre")
    .eq("id", versionId)
    .single();
  if (!version) notFound();

  const { data: material } = await supabase
    .from("materiales")
    .select("id, codigo, nombre, unidad_base, categoria")
    .eq("id", materialId)
    .single();
  if (!material) notFound();

  // Reusa la misma lógica del endpoint inline (server component)
  const { data: runs } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", versionId)
    .eq("estado", "exitoso")
    .order("finalizado_en", { ascending: false })
    .limit(1);
  const runId = runs?.[0]?.id as string | undefined;

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", FINAL_ORDS);
  const procesosById = new Map<string, { ord: number; nombre: string }>(
    (procesos ?? []).map(p => [p.id, { ord: p.ord, nombre: p.nombre }]),
  );

  let aportes: Aporte[] = [];
  let totalAporte = 0;

  if (runId && procesosById.size > 0) {
    const procIds = Array.from(procesosById.keys());
    const [{ data: logs }, { data: costos }] = await Promise.all([
      supabase
        .from("calculation_log")
        .select("proceso_id, periodo, valor_resultado, calculo_tipo")
        .eq("run_id", runId)
        .eq("material_id", materialId)
        .in("proceso_id", procIds),
      supabase
        .from("costo_proceso")
        .select("proceso_id, periodo, costo_por_ton")
        .eq("run_id", runId)
        .in("proceso_id", procIds),
    ]);
    const costoByKey = new Map<string, number>(
      (costos ?? []).map(c => [`${c.proceso_id}|${c.periodo}`, Number(c.costo_por_ton)]),
    );
    const sumByKey = new Map<string, number>();
    for (const l of logs ?? []) {
      if (!["precio_componente_directo","precio_componente_derivado","costo_mp_prehomo","costo_mp_adiciones"].includes(l.calculo_tipo)) continue;
      const k = `${l.proceso_id}|${l.periodo}`;
      sumByKey.set(k, (sumByKey.get(k) ?? 0) + Number(l.valor_resultado));
    }
    for (const [k, aporte] of Array.from(sumByKey.entries())) {
      const [proceso_id, periodo] = k.split("|");
      const meta = procesosById.get(proceso_id);
      if (!meta) continue;
      const costo = costoByKey.get(k) ?? 0;
      aportes.push({
        proceso_id, ord: meta.ord, nombre_proceso: meta.nombre, periodo,
        aporte_cop_ton: aporte, costo_proceso_cop_ton: costo,
        pct_costo: costo > 0 ? aporte / costo : 0,
      });
      totalAporte += aporte;
    }
    aportes.sort((a, b) => (a.ord - b.ord) || a.periodo.localeCompare(b.periodo));
  }

  // Agrupar por proceso para resumen
  const byProceso = new Map<string, { ord: number; nombre: string; total: number; n: number }>();
  for (const a of aportes) {
    const cur = byProceso.get(a.proceso_id) ?? { ord: a.ord, nombre: a.nombre_proceso, total: 0, n: 0 };
    cur.total += a.aporte_cop_ton;
    cur.n += 1;
    byProceso.set(a.proceso_id, cur);
  }
  const resumen = Array.from(byProceso.values()).sort((a, b) => a.ord - b.ord);

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${versionId}`} className="hover:underline">{version.nombre}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Impacto de insumo</span>
      </nav>

      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">{material.nombre}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="font-mono">{material.codigo}</span> · {material.categoria ?? "—"} · {material.unidad_base}
        </p>
      </div>

      {!runId ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">No hay runs exitosos para esta versión. Ejecuta un cálculo primero.</p>
          <Link href={`/versiones/${versionId}/calcular`} className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            Ir a calcular →
          </Link>
        </div>
      ) : aportes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">
            Este insumo no aparece como aporte directo ni derivado en ningún producto final.
            Puede ser un insumo intermedio cuyo costo se consolida en un semielaborado superior.
          </p>
        </div>
      ) : (
        <>
          {/* Resumen por proceso */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-5">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Aporte agregado por producto final</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Proceso</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Aporte total (COP/Ton)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Periodos con aporte</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map(r => (
                  <tr key={r.ord} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="font-mono text-gray-500">ORD {r.ord}</span> {r.nombre}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.total)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.n}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalAporte)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{aportes.length}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detalle por proceso × periodo */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Detalle por proceso × periodo</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-white border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Proceso</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Periodo</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Aporte (COP/Ton)</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Costo proceso (COP/Ton)</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">% costo</th>
                  </tr>
                </thead>
                <tbody>
                  {aportes.map((a, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="font-mono text-gray-500">ORD {a.ord}</span> {a.nombre_proceso}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtPeriodo(a.periodo)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(a.aporte_cop_ton)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(a.costo_proceso_cop_ton)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {(a.pct_costo * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
