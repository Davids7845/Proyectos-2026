"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  unidad_base: string;
  categoria: string | null;
  tipo_insumo: string | null;
  activo: boolean;
}

const CATEGORIA_COLORS: Record<string, string> = {
  materia_prima: "bg-green-100 text-green-700",
  semielaborado: "bg-blue-100 text-blue-700",
  combustible:   "bg-orange-100 text-orange-700",
  energia:       "bg-yellow-100 text-yellow-700",
  empaque:       "bg-purple-100 text-purple-700",
  producto:      "bg-teal-100 text-teal-700",
  repuesto:      "bg-red-100 text-red-700",
  servicio:      "bg-gray-100 text-gray-700",
};

export default function MaterialesTable({
  materiales,
  categorias,
}: {
  materiales: Material[];
  categorias: string[];
}) {
  const [filtro, setFiltro] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const lista = materiales.filter(m => {
    if (soloActivos && !m.activo) return false;
    if (catFiltro && m.categoria !== catFiltro) return false;
    if (filtro) {
      const q = filtro.toLowerCase();
      return m.codigo.toLowerCase().includes(q) || m.nombre.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="search"
          placeholder="Buscar código o nombre…"
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={catFiltro}
          onChange={e => setCatFiltro(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={e => setSoloActivos(e.target.checked)}
            className="rounded"
          />
          Solo activos
        </label>
        <span className="text-xs text-gray-400 ml-auto">{lista.length} resultados</span>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Nuevo material
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-28">Código</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-20">Unidad</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-32">Categoría</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-36">Tipo insumo</th>
              <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Activo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((m, i) => (
              <MaterialRow key={m.id} material={m} even={i % 2 === 0} />
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No hay materiales que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <NuevoMaterialModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

// ─── Fila editable ───────────────────────────────────────────────────────────

function MaterialRow({ material, even }: { material: Material; even: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(material.nombre);
  const [unidad, setUnidad] = useState(material.unidad_base);
  const [editing, setEditing] = useState<"nombre" | "unidad" | null>(null);

  async function save(field: "nombre" | "unidad") {
    const payload = field === "nombre" ? { nombre: nombre.trim() } : { unidad_base: unidad.trim() };
    const res = await fetch(`/api/admin/materiales/${material.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setEditing(null);
      startTransition(() => router.refresh());
    }
  }

  async function toggleActivo() {
    await fetch(`/api/admin/materiales/${material.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !material.activo }),
    });
    startTransition(() => router.refresh());
  }

  const catColor = CATEGORIA_COLORS[material.categoria ?? ""] ?? "bg-gray-100 text-gray-600";

  return (
    <tr className={`border-b border-gray-100 ${even ? "" : "bg-gray-50/40"} ${!material.activo ? "opacity-50" : ""}`}>
      <td className="px-4 py-2 font-mono text-xs text-gray-700">{material.codigo}</td>

      <td className="px-4 py-2">
        {editing === "nombre" ? (
          <InlineInput value={nombre} onChange={setNombre}
            onSave={() => save("nombre")} onCancel={() => { setNombre(material.nombre); setEditing(null); }} />
        ) : (
          <span className="cursor-pointer hover:text-blue-700 hover:underline"
            onClick={() => setEditing("nombre")} title="Click para editar">{nombre}</span>
        )}
      </td>

      <td className="px-4 py-2 text-gray-600">
        {editing === "unidad" ? (
          <InlineInput value={unidad} onChange={setUnidad} width="w-20"
            onSave={() => save("unidad")} onCancel={() => { setUnidad(material.unidad_base); setEditing(null); }} />
        ) : (
          <span className="cursor-pointer hover:text-blue-700 hover:underline font-mono text-xs"
            onClick={() => setEditing("unidad")} title="Click para editar">{unidad}</span>
        )}
      </td>

      <td className="px-4 py-2">
        {material.categoria && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${catColor}`}>
            {material.categoria}
          </span>
        )}
      </td>

      <td className="px-4 py-2 text-xs text-gray-500">{material.tipo_insumo ?? "—"}</td>

      <td className="px-4 py-2 text-center">
        <button
          onClick={toggleActivo}
          disabled={isPending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            material.activo ? "bg-blue-600" : "bg-gray-300"
          } disabled:opacity-50`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            material.activo ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </button>
      </td>
    </tr>
  );
}

// ─── Modal nuevo material ────────────────────────────────────────────────────

function NuevoMaterialModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    codigo: "", nombre: "", unidad_base: "T", categoria: "materia_prima", tipo_insumo: "",
  });
  const [error, setError] = useState<string | null>(null);

  const categorias = ["materia_prima", "semielaborado", "combustible", "energia", "empaque", "producto", "repuesto", "servicio"];

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleCreate() {
    setError(null);
    const res = await fetch("/api/admin/materiales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        codigo: form.codigo.toUpperCase(),
        tipo_insumo: form.tipo_insumo || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Error al crear");
      return;
    }
    startTransition(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Nuevo material</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {[
            { label: "Código", key: "codigo" as const, hint: "Mayúsculas y guión bajo. Ej: CALIZA_XX" },
            { label: "Nombre", key: "nombre" as const },
            { label: "Unidad base", key: "unidad_base" as const, hint: "T, kg, kWh, UN, Gal…" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type="text"
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {f.hint && <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>}
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={form.categoria}
              onChange={e => set("categoria", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo insumo <span className="text-gray-400">(opcional)</span></label>
            <input
              type="text"
              value={form.tipo_insumo}
              onChange={e => set("tipo_insumo", e.target.value)}
              placeholder="Ej: Caliza, Carbón, Aditivo…"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={isPending || !form.codigo || !form.nombre}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creando…" : "Crear material"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineInput({
  value, onChange, onSave, onCancel, width = "w-48",
}: {
  value: string; onChange: (v: string) => void;
  onSave: () => void; onCancel: () => void; width?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        className={`${width} border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
      <button onClick={onSave} className="text-xs text-blue-600 hover:underline">✓</button>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:underline">✕</button>
    </div>
  );
}
