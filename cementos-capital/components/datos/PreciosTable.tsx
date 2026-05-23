"use client";

import { useMemo, useState } from "react";

interface Precio {
  id: string;
  material_id: string;
  proveedor: string | null;
  periodo: string;
  precio_unitario: number;
  unidad: string;
}

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  unidad_base: string;
  categoria: string | null;
}

interface Props {
  versionId: string;
  precios: Precio[];
  materiales: Material[];
  periodos: string[];
  editable: boolean;
}

function formatPeriodoHeader(p: string): string {
  // "2025-09-01" → "Sep-25"
  const d = new Date(p);
  const mes = d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" });
  return `${mes.replace(".", "")}-${String(d.getUTCFullYear()).slice(2)}`;
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(n);
}

export default function PreciosTable({ versionId, precios, materiales, periodos, editable }: Props) {
  const matById = useMemo(() => new Map(materiales.map(m => [m.id, m])), [materiales]);

  // Pivote: por (material_id + proveedor), un objeto con un campo por periodo
  type RowKey = string;
  interface PivotRow {
    rowKey: RowKey;
    material_id: string;
    proveedor: string | null;
    unidad: string;
    cells: Map<string, { id: string; precio: number }>;
  }

  const initialPivot = useMemo<PivotRow[]>(() => {
    const map = new Map<RowKey, PivotRow>();
    for (const p of precios) {
      const k = `${p.material_id}||${p.proveedor ?? ""}`;
      let row = map.get(k);
      if (!row) {
        row = {
          rowKey: k,
          material_id: p.material_id,
          proveedor: p.proveedor,
          unidad: p.unidad,
          cells: new Map(),
        };
        map.set(k, row);
      }
      row.cells.set(p.periodo, { id: p.id, precio: Number(p.precio_unitario) });
    }
    return Array.from(map.values()).sort((a, b) => {
      const na = matById.get(a.material_id)?.nombre ?? "";
      const nb = matById.get(b.material_id)?.nombre ?? "";
      return na.localeCompare(nb);
    });
  }, [precios, matById]);

  const [rows] = useState(initialPivot);
  const [editing, setEditing] = useState<{ rowKey: RowKey; periodo: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map()); // precioId → nuevo valor
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function commitEdit(precioId: string, nuevoValor: number) {
    setSavingId(precioId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/versiones/${versionId}/precios`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: precioId, precio_unitario: nuevoValor }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setOverrides(prev => {
        const next = new Map(prev);
        next.set(precioId, nuevoValor);
        return next;
      });
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setSavingId(null);
      setEditing(null);
    }
  }

  return (
    <div>
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs mb-2">
          {errorMsg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="text-sm w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                Material
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Proveedor</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Unidad</th>
              {periodos.map(p => (
                <th key={p} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">
                  {formatPeriodoHeader(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const mat = matById.get(r.material_id);
              return (
                <tr key={r.rowKey} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    {mat?.nombre ?? r.material_id}
                    {mat?.codigo && <span className="ml-1 text-xs text-gray-400 font-normal">{mat.codigo}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.proveedor ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{r.unidad}</td>
                  {periodos.map(p => {
                    const cell = r.cells.get(p);
                    if (!cell) {
                      return <td key={p} className="px-3 py-2 text-right text-gray-300 tabular-nums">—</td>;
                    }
                    const isEditing = editing?.rowKey === r.rowKey && editing?.periodo === p;
                    const value = overrides.get(cell.id) ?? cell.precio;
                    if (isEditing) {
                      return (
                        <td key={p} className="px-1 py-1 text-right">
                          <input
                            type="number"
                            step="any"
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => {
                              const n = Number(editValue);
                              if (Number.isFinite(n) && n !== value) commitEdit(cell.id, n);
                              else setEditing(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                const n = Number(editValue);
                                if (Number.isFinite(n)) commitEdit(cell.id, n);
                              } else if (e.key === "Escape") {
                                setEditing(null);
                              }
                            }}
                            className="w-24 text-right text-xs px-1 py-0.5 border border-blue-400 rounded tabular-nums"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={p}
                        onClick={() => {
                          if (!editable) return;
                          setEditing({ rowKey: r.rowKey, periodo: p });
                          setEditValue(String(value));
                        }}
                        className={`px-3 py-2 text-right tabular-nums text-gray-700 ${editable ? "cursor-pointer hover:bg-blue-50" : ""} ${savingId === cell.id ? "opacity-50" : ""} ${overrides.has(cell.id) ? "bg-yellow-50" : ""}`}
                        title={editable ? "Click para editar" : ""}
                      >
                        {formatCOP(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable && (
        <p className="text-xs text-gray-400 mt-2">
          Click en cualquier celda numérica para editar · Enter para guardar · Esc para cancelar
        </p>
      )}
    </div>
  );
}
