"use client";

import { useState, useTransition } from "react";
import { BRAND } from "@/lib/ui/colors";
import type { AgregadoGroup } from "./page";

interface MaterialBase {
  id: string;
  codigo: string;
  nombre: string;
}

interface Componente {
  id: string;
  porcentaje: number;
  orden: number;
  notas: string | null;
  material_origen: MaterialBase;
}

interface Props {
  agregados: AgregadoGroup[];
  allMateriales: MaterialBase[];
}

export default function MaterilesAgregadosClient({ agregados: initialAgregados, allMateriales }: Props) {
  const [agregados, setAgregados] = useState<AgregadoGroup[]>(initialAgregados);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState<string>("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newOrigenId, setNewOrigenId] = useState<string>("");
  const [newPct, setNewPct] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending] = useTransition();

  function pctDisplay(p: number) {
    return (p * 100).toFixed(2);
  }

  async function handleSavePct(compId: string, destinoId: string) {
    const pct = parseFloat(editPct) / 100;
    if (isNaN(pct) || pct < 0 || pct > 1) {
      setError("Porcentaje inválido (0–100)");
      return;
    }
    setError(null);
    const res = await fetch(`/api/materiales-agregados/${compId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ porcentaje: pct }),
    });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error ?? "Error al guardar");
      return;
    }
    setAgregados(prev => prev.map(g => {
      if (g.material_destino.id !== destinoId) return g;
      const comps = g.componentes.map(c =>
        c.id === compId ? { ...c, porcentaje: pct } : c
      );
      return { ...g, componentes: comps, suma_porcentajes: comps.reduce((s, c) => s + c.porcentaje, 0) };
    }));
    setEditingId(null);
  }

  async function handleDelete(compId: string, destinoId: string) {
    if (!confirm("¿Eliminar este componente de la composición?")) return;
    const res = await fetch(`/api/materiales-agregados/${compId}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: "Error" }));
      setError(e.error ?? "Error al eliminar");
      return;
    }
    setAgregados(prev => prev.map(g => {
      if (g.material_destino.id !== destinoId) return g;
      const comps = g.componentes.filter(c => c.id !== compId);
      return { ...g, componentes: comps, suma_porcentajes: comps.reduce((s, c) => s + c.porcentaje, 0) };
    }));
  }

  async function handleAdd(destinoId: string) {
    if (!newOrigenId) { setError("Selecciona un material origen"); return; }
    const pct = parseFloat(newPct) / 100;
    if (isNaN(pct) || pct < 0 || pct > 1) { setError("Porcentaje inválido (0–100)"); return; }
    setError(null);
    const res = await fetch("/api/materiales-agregados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ material_destino_id: destinoId, material_origen_id: newOrigenId, porcentaje: pct }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? "Error al agregar"); return; }

    const mat = allMateriales.find(m => m.id === newOrigenId)!;
    setAgregados(prev => prev.map(g => {
      if (g.material_destino.id !== destinoId) return g;
      const newComp: Componente = { id: body.data.id, porcentaje: pct, orden: body.data.orden, notas: null, material_origen: mat };
      const comps = [...g.componentes, newComp];
      return { ...g, componentes: comps, suma_porcentajes: comps.reduce((s, c) => s + c.porcentaje, 0) };
    }));
    setAddingTo(null);
    setNewOrigenId("");
    setNewPct("");
  }

  const sumaOk = (suma: number) => Math.abs(suma - 1) < 0.001;

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="text-sm px-4 py-2.5 rounded-lg border"
          style={{ backgroundColor: BRAND.dangerSoft, borderColor: BRAND.danger, color: BRAND.danger }}
        >
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {agregados.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center text-sm text-slate-400">
          No hay materiales agregados configurados.
        </div>
      )}

      {agregados.map(grupo => {
        const suma = grupo.suma_porcentajes;
        const ok = sumaOk(suma);
        return (
          <div key={grupo.material_destino.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div
              className="px-5 py-3 flex items-center gap-3 border-b border-slate-200"
              style={{ backgroundColor: BRAND.bgBand }}
            >
              <div>
                <span className="font-semibold text-slate-900">{grupo.material_destino.nombre}</span>
                <span className="ml-2 text-xs text-slate-400 font-mono">({grupo.material_destino.codigo})</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: ok ? BRAND.successSoft : BRAND.warningSoft,
                    color: ok ? BRAND.success : BRAND.warning,
                  }}
                >
                  {(suma * 100).toFixed(2)}%{ok ? " ✓" : " ⚠ ≠100%"}
                </span>
              </div>
            </div>

            {/* Componentes */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Origen (proveedor)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-32">Porcentaje</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupo.componentes.map((comp, idx) => (
                  <tr
                    key={comp.id}
                    className="border-b border-slate-50"
                    style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : undefined }}
                  >
                    <td className="px-5 py-2.5 text-slate-800">
                      {comp.material_origen.nombre}
                      <span className="ml-1.5 text-xs text-slate-400 font-mono">({comp.material_origen.codigo})</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {editingId === comp.id ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={editPct}
                            onChange={e => setEditPct(e.target.value)}
                            className="w-20 text-right border border-slate-300 rounded px-2 py-0.5 text-sm tabular-nums focus:outline-none"
                            style={{ borderColor: BRAND.primary }}
                          />
                          <span className="text-slate-400 text-xs">%</span>
                          <button
                            onClick={() => handleSavePct(comp.id, grupo.material_destino.id)}
                            disabled={isPending}
                            className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
                            style={{ backgroundColor: BRAND.primary, color: "#fff" }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-50"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-slate-700">{pctDisplay(comp.porcentaje)} %</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {editingId !== comp.id && (
                          <button
                            onClick={() => { setEditingId(comp.id); setEditPct(pctDisplay(comp.porcentaje)); }}
                            className="text-xs px-2 py-0.5 rounded border hover:bg-slate-50 text-slate-600 border-slate-300"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(comp.id, grupo.material_destino.id)}
                          className="text-xs px-2 py-0.5 rounded border hover:bg-red-50 text-red-500 border-red-300"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add component form */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              {addingTo === grupo.material_destino.id ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={newOrigenId}
                    onChange={e => setNewOrigenId(e.target.value)}
                    className="flex-1 min-w-40 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none"
                    style={{ borderColor: BRAND.primary }}
                  >
                    <option value="">— Seleccionar origen —</option>
                    {allMateriales
                      .filter(m => m.id !== grupo.material_destino.id && !grupo.componentes.find(c => c.material_origen.id === m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.nombre} ({m.codigo})</option>
                      ))
                    }
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="% (0-100)"
                    value={newPct}
                    onChange={e => setNewPct(e.target.value)}
                    className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none"
                  />
                  <span className="text-slate-400 text-sm">%</span>
                  <button
                    onClick={() => handleAdd(grupo.material_destino.id)}
                    disabled={isPending}
                    className="text-sm px-3 py-1 rounded font-medium transition-colors"
                    style={{ backgroundColor: BRAND.primary, color: "#fff" }}
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => { setAddingTo(null); setNewOrigenId(""); setNewPct(""); }}
                    className="text-sm px-2 py-1 rounded border border-slate-300 hover:bg-white text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(grupo.material_destino.id); setEditingId(null); }}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                >
                  <span style={{ color: BRAND.primary }}>+</span> Agregar componente
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
