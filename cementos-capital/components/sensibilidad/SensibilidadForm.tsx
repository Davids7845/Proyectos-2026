"use client";

import { useState, useMemo } from "react";

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  precio: number;
}

interface Delta {
  proceso_id: string;
  ord: number;
  nombre: string;
  periodo: string;
  base_cop_ton: number;
  sens_cop_ton: number;
  delta_abs: number;
  delta_pct: number;
}

interface Result {
  deltas: Delta[];
  applied_overrides: Array<{ material_codigo: string; factor: number }>;
  skipped: Array<{ ord: number; periodo: string; reason: string }>;
}

interface Props {
  versionId: string;
  materiales: Material[];
}

const FINAL_ORDS = [6, 7, 8, 9, 10, 11, 14, 15, 16, 19, 21];

function fmt(n: number, dec = 0): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPeriodo(p: string): string {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export default function SensibilidadForm({ versionId, materiales }: Props) {
  // Variaciones por código (en %, ej +10 → factor 1.10)
  const [variaciones, setVariaciones] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const variacionesActivas = useMemo(
    () => Object.entries(variaciones).filter(([, v]) => v !== 0 && isFinite(v)),
    [variaciones],
  );

  async function handleCalcular() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const overrides = variacionesActivas.map(([codigo, pct]) => ({
        tipo: "precio_material" as const,
        material_codigo: codigo,
        factor: 1 + (pct / 100),
      }));
      const res = await fetch(`/api/versiones/${versionId}/sensibilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const j = await res.json();
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Filtrar deltas por productos finales para vista resumen
  const deltasFinales = useMemo(
    () => (result?.deltas ?? []).filter(d => FINAL_ORDS.includes(d.ord)),
    [result],
  );

  // Resumen agregado por proceso (promedio del delta_pct sobre periodos)
  const resumenPorProceso = useMemo(() => {
    const m = new Map<number, { ord: number; nombre: string; avg_pct: number; max_pct: number; n: number }>();
    for (const d of deltasFinales) {
      const cur = m.get(d.ord) ?? { ord: d.ord, nombre: d.nombre, avg_pct: 0, max_pct: -Infinity, n: 0 };
      cur.avg_pct += d.delta_pct;
      cur.max_pct = Math.max(cur.max_pct, Math.abs(d.delta_pct));
      cur.n += 1;
      m.set(d.ord, cur);
    }
    return Array.from(m.values())
      .map(r => ({ ...r, avg_pct: r.n > 0 ? r.avg_pct / r.n : 0 }))
      .sort((a, b) => b.max_pct - a.max_pct);
  }, [deltasFinales]);

  // Top 5 cambios individuales
  const topDeltas = useMemo(
    () => (result?.deltas ?? [])
      .slice()
      .sort((a, b) => Math.abs(b.delta_abs) - Math.abs(a.delta_abs))
      .slice(0, 5),
    [result],
  );

  return (
    <div className="space-y-5">
      {/* Tabla de variables */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-700">Variables</h2>
          <span className="text-xs text-gray-500">{materiales.length} materiales · {variacionesActivas.length} con cambio</span>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-white border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Material</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Categoría</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Precio ref. (COP)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Variación %</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Precio resultante</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map(m => {
                const pct = variaciones[m.codigo] ?? 0;
                const resultPrecio = m.precio * (1 + pct / 100);
                return (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="px-3 py-1.5">
                      {m.nombre}
                      <span className="ml-1 text-gray-400 font-mono">{m.codigo}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{m.categoria}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.precio)}</td>
                    <td className="px-1 py-1 text-right">
                      <input
                        type="number"
                        step="0.5"
                        value={pct === 0 ? "" : pct}
                        onChange={e => setVariaciones(v => ({ ...v, [m.codigo]: Number(e.target.value || 0) }))}
                        placeholder="0"
                        className="w-20 px-2 py-1 text-right tabular-nums border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${pct === 0 ? "text-gray-400" : "text-blue-700 font-medium"}`}>
                      {fmt(resultPrecio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
          <button
            onClick={handleCalcular}
            disabled={loading || variacionesActivas.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? "Calculando impacto…" : "Calcular impacto"}
          </button>
          {variacionesActivas.length === 0 && <span className="text-xs text-gray-500 self-center">Define al menos una variación</span>}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm whitespace-pre-wrap">{error}</div>
      )}

      {result && (
        <>
          {/* Resumen por producto final */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Impacto en productos finales (promedio sobre periodos)</h2>
            </div>
            {resumenPorProceso.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500">Los cambios no afectaron procesos terminales (puede ser un insumo intermedio no usado en este corte).</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 bg-gray-50 text-left font-medium text-gray-600">Proceso</th>
                    <th className="px-3 py-2 bg-gray-50 text-right font-medium text-gray-600">Δ promedio %</th>
                    <th className="px-3 py-2 bg-gray-50 text-right font-medium text-gray-600">Δ máx %</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorProceso.map(r => (
                    <tr key={r.ord} className="border-t border-gray-100">
                      <td className="px-3 py-1.5">
                        <span className="font-mono text-gray-500">ORD {r.ord}</span> {r.nombre}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${r.avg_pct > 0 ? "text-red-700" : r.avg_pct < 0 ? "text-green-700" : ""}`}>
                        {(r.avg_pct * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{(r.max_pct * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top 5 cambios */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Top 5 cambios individuales</h2>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 bg-gray-50 text-left font-medium text-gray-600">Proceso</th>
                  <th className="px-3 py-2 bg-gray-50 text-left font-medium text-gray-600">Periodo</th>
                  <th className="px-3 py-2 bg-gray-50 text-right font-medium text-gray-600">Base (COP/Ton)</th>
                  <th className="px-3 py-2 bg-gray-50 text-right font-medium text-gray-600">Sensibilizado</th>
                  <th className="px-3 py-2 bg-gray-50 text-right font-medium text-gray-600">Δ abs</th>
                  <th className="px-3 py-2 bg-gray-50 text-right font-medium text-gray-600">Δ %</th>
                </tr>
              </thead>
              <tbody>
                {topDeltas.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5">ORD {d.ord} {d.nombre}</td>
                    <td className="px-3 py-1.5">{fmtPeriodo(d.periodo)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.base_cop_ton)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(d.sens_cop_ton)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${d.delta_abs > 0 ? "text-red-700" : "text-green-700"}`}>
                      {d.delta_abs > 0 ? "+" : ""}{fmt(d.delta_abs)}
                    </td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${d.delta_pct > 0 ? "text-red-700" : "text-green-700"}`}>
                      {(d.delta_pct * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.skipped && result.skipped.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Periodos/procesos omitidos: {result.skipped.length}</summary>
              <ul className="mt-2 space-y-0.5 ml-3">
                {result.skipped.slice(0, 20).map((s, i) => (
                  <li key={i}>ORD {s.ord} / {s.periodo}: {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
