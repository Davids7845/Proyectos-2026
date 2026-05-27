"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface VersionMin {
  id: string;
  nombre: string;
}

export default function CompareButton({ versiones }: { versiones: VersionMin[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [baseId, setBaseId] = useState("");
  const [compId, setCompId] = useState("");

  const canCompare = baseId && compId && baseId !== compId;

  function handleGo() {
    if (!canCompare) return;
    router.push(`/versiones/${baseId}/compare/${compId}`);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        Comparar dos versiones
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[460px] max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-4">Comparar versiones</h3>

        <label className="block mb-3">
          <span className="text-sm text-gray-700">Versión base</span>
          <select
            value={baseId}
            onChange={e => setBaseId(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Selecciona...</option>
            {versiones.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block mb-5">
          <span className="text-sm text-gray-700">Comparar contra</span>
          <select
            value={compId}
            onChange={e => setCompId(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Selecciona...</option>
            {versiones.filter(v => v.id !== baseId).map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setBaseId(""); setCompId(""); }}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGo}
            disabled={!canCompare}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            Ir a la comparación
          </button>
        </div>
      </div>
    </div>
  );
}
