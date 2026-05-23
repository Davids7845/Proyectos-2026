"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Proceso {
  id: string;
  ord: number;
  nombre: string;
  material: string;
  orden_topologico: number;
  activo: boolean;
  implementado: boolean;
}

export default function ProcesosTable({ procesos }: { procesos: Proceso[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-gray-600 w-16">ORD</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-600">Nombre</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-600">Material de salida</th>
            <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Topo</th>
            <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-28">Calculador</th>
            <th className="px-4 py-2.5 text-center font-medium text-gray-600 w-20">Activo</th>
          </tr>
        </thead>
        <tbody>
          {procesos.map((p, i) => (
            <ProcesoRow key={p.id} proceso={p} even={i % 2 === 0} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProcesoRow({ proceso, even }: { proceso: Proceso; even: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<"nombre" | "material" | "topo" | null>(null);
  const [nombre, setNombre] = useState(proceso.nombre);
  const [material, setMaterial] = useState(proceso.material);
  const [topo, setTopo] = useState(String(proceso.orden_topologico));
  const [error, setError] = useState<string | null>(null);

  async function save(field: "nombre" | "material" | "topo") {
    const payload: Record<string, unknown> = {};
    if (field === "nombre")   payload.nombre = nombre.trim();
    if (field === "material") payload.material = material.trim();
    if (field === "topo")     payload.orden_topologico = parseInt(topo, 10);

    if (field === "topo" && !Number.isFinite(payload.orden_topologico as number)) {
      setError("El orden debe ser un número entero"); return;
    }

    setError(null);
    const res = await fetch(`/api/admin/procesos/${proceso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Error al guardar");
      return;
    }
    setEditing(null);
    startTransition(() => router.refresh());
  }

  async function toggleActivo() {
    await fetch(`/api/admin/procesos/${proceso.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !proceso.activo }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <tr className={`border-b border-gray-100 ${even ? "" : "bg-gray-50/40"} ${!proceso.activo ? "opacity-50" : ""}`}>
      {/* ORD */}
      <td className="px-4 py-2.5 text-gray-500 tabular-nums font-mono">{proceso.ord}</td>

      {/* Nombre */}
      <td className="px-4 py-2.5">
        {editing === "nombre" ? (
          <InlineInput
            value={nombre}
            onChange={setNombre}
            onSave={() => save("nombre")}
            onCancel={() => { setNombre(proceso.nombre); setEditing(null); }}
          />
        ) : (
          <span
            className="cursor-pointer hover:text-blue-700 hover:underline"
            onClick={() => setEditing("nombre")}
            title="Click para editar"
          >
            {nombre}
          </span>
        )}
      </td>

      {/* Material */}
      <td className="px-4 py-2.5 text-gray-600">
        {editing === "material" ? (
          <InlineInput
            value={material}
            onChange={setMaterial}
            onSave={() => save("material")}
            onCancel={() => { setMaterial(proceso.material); setEditing(null); }}
          />
        ) : (
          <span
            className="cursor-pointer hover:text-blue-700 hover:underline text-xs font-mono"
            onClick={() => setEditing("material")}
            title="Click para editar"
          >
            {material}
          </span>
        )}
      </td>

      {/* Orden topológico */}
      <td className="px-4 py-2.5 text-center">
        {editing === "topo" ? (
          <InlineInput
            value={topo}
            onChange={setTopo}
            onSave={() => save("topo")}
            onCancel={() => { setTopo(String(proceso.orden_topologico)); setEditing(null); }}
            width="w-16"
            type="number"
          />
        ) : (
          <span
            className="cursor-pointer hover:text-blue-700 hover:underline tabular-nums"
            onClick={() => setEditing("topo")}
            title="Click para editar"
          >
            {topo}
          </span>
        )}
      </td>

      {/* Calculador implementado */}
      <td className="px-4 py-2.5 text-center">
        {proceso.implementado ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            ✓ Listo
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
            Pendiente
          </span>
        )}
      </td>

      {/* Toggle activo */}
      <td className="px-4 py-2.5 text-center">
        <button
          onClick={toggleActivo}
          disabled={isPending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            proceso.activo ? "bg-blue-600" : "bg-gray-300"
          } disabled:opacity-50`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            proceso.activo ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
    </tr>
  );
}

function InlineInput({
  value, onChange, onSave, onCancel, width = "w-40", type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  width?: string;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        className={`${width} border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
      />
      <button onClick={onSave} className="text-xs text-blue-600 hover:underline">✓</button>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:underline">✕</button>
    </div>
  );
}
