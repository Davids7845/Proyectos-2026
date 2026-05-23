"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Linea {
  material_id: string;
  material_codigo: string;
  material_nombre: string;
  porcentaje: number;
  orden: number;
}

interface RecetaDato {
  receta_id: string;
  producto_nombre: string;
  lineas: Linea[];
}

interface ProcesoDato {
  proceso_id: string;
  ord: number;
  nombre: string;
  recetasByPeriodo: Record<string, RecetaDato>;
}

interface Props {
  versionId: string;
  procesos: ProcesoDato[];
  periodos: string[];
  editable: boolean;
}

export default function RecetasAccordion({ versionId, procesos, periodos, editable }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    proceso_id: string;
    proceso_nombre: string;
    periodo: string;
    receta: RecetaDato;
  } | null>(null);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {procesos.map((proc, i) => {
        const isOpen = open === proc.proceso_id;
        const periodosConReceta = periodos.filter(p => proc.recetasByPeriodo[p]);
        return (
          <div key={proc.proceso_id} className={i > 0 ? "border-t border-gray-100" : ""}>
            {/* Header del proceso */}
            <button
              onClick={() => setOpen(isOpen ? null : proc.proceso_id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-8 text-right">{proc.ord}</span>
                <span className="font-medium text-gray-900 text-sm">{proc.nombre}</span>
                <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                  {periodosConReceta.length} {periodosConReceta.length === 1 ? "periodo" : "periodos"}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Detalle expandido */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1.5 pr-4 font-medium text-gray-600 text-xs">Material</th>
                        {periodos.map(p => (
                          <th key={p} className="text-right py-1.5 px-2 font-medium text-gray-600 text-xs tabular-nums whitespace-nowrap">
                            {formatPeriodoCorto(p)}
                          </th>
                        ))}
                        {editable && <th className="py-1.5 px-2 text-xs font-medium text-gray-600">Editar</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Filas por material (unión de todos los periodos) */}
                      {buildMaterialRows(proc, periodos).map(row => (
                        <tr key={row.material_id} className="border-b border-gray-100">
                          <td className="py-1.5 pr-4 text-gray-800 text-xs">
                            <span className="text-gray-400 mr-1.5 font-mono">{row.material_codigo}</span>
                            {row.material_nombre}
                          </td>
                          {periodos.map(p => {
                            const pct = row.byPeriodo[p];
                            return (
                              <td key={p} className={`py-1.5 px-2 text-right tabular-nums text-xs ${pct != null ? "text-gray-800" : "text-gray-300"}`}>
                                {pct != null ? `${(pct * 100).toFixed(2)} %` : "—"}
                              </td>
                            );
                          })}
                          {editable && <td />}
                        </tr>
                      ))}

                      {/* Fila "Editar" por periodo */}
                      {editable && (
                        <tr>
                          <td className="py-1.5 pr-4 text-xs text-gray-400 italic">Total / Editar</td>
                          {periodos.map(p => {
                            const receta = proc.recetasByPeriodo[p];
                            const total = receta ? receta.lineas.reduce((s, l) => s + l.porcentaje, 0) : null;
                            return (
                              <td key={p} className="py-1.5 px-2 text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  {total != null && (
                                    <span className={`text-xs tabular-nums ${Math.abs(total - 1) > 0.001 ? "text-orange-600" : "text-gray-400"}`}>
                                      {(total * 100).toFixed(1)} %
                                    </span>
                                  )}
                                  {receta ? (
                                    <button
                                      onClick={() => setEditing({ proceso_id: proc.proceso_id, proceso_nombre: proc.nombre, periodo: p, receta })}
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      editar
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal de edición */}
      {editing && (
        <RecetaEditModal
          versionId={versionId}
          procesoId={editing.proceso_id}
          procesoNombre={editing.proceso_nombre}
          periodo={editing.periodo}
          receta={editing.receta}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── Modal de edición ────────────────────────────────────────────────────────

function RecetaEditModal({
  versionId,
  procesoId,
  procesoNombre,
  periodo,
  receta,
  onClose,
}: {
  versionId: string;
  procesoId: string;
  procesoNombre: string;
  periodo: string;
  receta: RecetaDato;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lineas, setLineas] = useState<Linea[]>(receta.lineas.map(l => ({ ...l })));
  const [error, setError] = useState<string | null>(null);

  const total = lineas.reduce((s, l) => s + l.porcentaje, 0);
  const totalOk = Math.abs(total - 1) <= 0.001;

  function updatePct(idx: number, raw: string) {
    const val = parseFloat(raw);
    if (!Number.isFinite(val)) return;
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, porcentaje: val / 100 } : l));
  }

  async function handleSave() {
    setError(null);
    const res = await fetch(`/api/versiones/${versionId}/recetas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proceso_id: procesoId,
        producto_id: lineas[0]?.material_id ?? procesoId, // fallback
        periodo,
        lineas: lineas.map((l, i) => ({
          material_id: l.material_id,
          porcentaje: l.porcentaje,
          orden: i + 1,
        })),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Error al guardar");
      return;
    }
    startTransition(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-500">{procesoNombre}</p>
            <h2 className="text-base font-semibold text-gray-900">Receta — {formatPeriodoCorto(periodo)}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-2 max-h-80 overflow-y-auto">
          {lineas.map((l, idx) => (
            <div key={l.material_id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{l.material_nombre}</p>
                <p className="text-xs text-gray-400 font-mono">{l.material_codigo}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  defaultValue={(l.porcentaje * 100).toFixed(4)}
                  onBlur={e => updatePct(idx, e.target.value)}
                  className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 w-3">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-3">
          <div className={`text-xs font-medium text-right ${totalOk ? "text-gray-400" : "text-orange-600"}`}>
            Total: {(total * 100).toFixed(3)} %{!totalOk && " ⚠ debe sumar 100 %"}
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildMaterialRows(
  proc: ProcesoDato,
  periodos: string[]
): Array<{ material_id: string; material_codigo: string; material_nombre: string; byPeriodo: Record<string, number> }> {
  const byMat = new Map<string, { material_codigo: string; material_nombre: string; byPeriodo: Record<string, number> }>();
  for (const periodo of periodos) {
    const receta = proc.recetasByPeriodo[periodo];
    if (!receta) continue;
    for (const ln of receta.lineas) {
      if (!byMat.has(ln.material_id)) {
        byMat.set(ln.material_id, {
          material_codigo: ln.material_codigo,
          material_nombre: ln.material_nombre,
          byPeriodo: {},
        });
      }
      byMat.get(ln.material_id)!.byPeriodo[periodo] = ln.porcentaje;
    }
  }
  return Array.from(byMat.entries()).map(([material_id, v]) => ({ material_id, ...v }));
}

function formatPeriodoCorto(periodo: string): string {
  const d = new Date(periodo + "T00:00:00");
  return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}
