"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Proceso { id: string; ord: number; nombre: string }
interface Override { proceso_id: string; periodo: string; precio_cop_ton: number }

interface Props {
  versionId: string;
  procesos: Proceso[];
  periodos: string[];
  overrides: Override[];
  editable: boolean;
}

function fmtPeriodo(p: string): string {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", {
    month: "short", year: "2-digit", timeZone: "UTC",
  });
}

export default function PreciosFijosEditor({ versionId, procesos, periodos, overrides, editable }: Props) {
  const router = useRouter();
  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of overrides) m[`${o.proceso_id}|${o.periodo}`] = String(o.precio_cop_ton);
    return m;
  }, [overrides]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const dirty = useMemo(() => {
    const keys = Array.from(new Set([...Object.keys(values), ...Object.keys(initial)]));
    for (const k of keys) {
      if ((values[k] ?? "") !== (initial[k] ?? "")) return true;
    }
    return false;
  }, [values, initial]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const rows: Array<{ proceso_id: string; periodo: string; precio_cop_ton: number | null }> = [];
      for (const proc of procesos) {
        for (const per of periodos) {
          const k = `${proc.id}|${per}`;
          const raw = values[k];
          const n = raw == null || raw.trim() === "" ? null : Number(raw);
          rows.push({ proceso_id: proc.id, periodo: per, precio_cop_ton: n });
        }
      }
      const res = await fetch(`/api/versiones/${versionId}/precios-fijos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API ${res.status}: ${txt}`);
      }
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Proceso</th>
                {periodos.map(p => (
                  <th key={p} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">
                    {fmtPeriodo(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {procesos.map(proc => (
                <tr key={proc.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-mono text-gray-500">ORD {proc.ord}</span> {proc.nombre}
                  </td>
                  {periodos.map(per => {
                    const k = `${proc.id}|${per}`;
                    return (
                      <td key={per} className="px-1 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          disabled={!editable}
                          value={values[k] ?? ""}
                          onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))}
                          placeholder="—"
                          className="w-28 px-2 py-1 text-right tabular-nums border border-gray-200 rounded focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">Cambios guardados.</div>}

      {editable && (
        <div className="flex gap-2 items-center">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {dirty && <span className="text-xs text-gray-500">Cambios sin guardar</span>}
        </div>
      )}
    </div>
  );
}
