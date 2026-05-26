"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NuevaVersionButton() {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [sapEnabled, setSapEnabled] = useState(false);
  const [preciosFijos, setPreciosFijos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("budget_versions").insert({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      estado: "borrador",
      sap_enabled: sapEnabled,
      precios_fijos: preciosFijos,
      periodo_inicio: "2025-09-01",
      periodo_fin: "2026-08-01",
      creado_por: user?.id ?? null,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setOpen(false);
    setNombre("");
    setDescripcion("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
      >
        + Nueva versión
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Nueva versión de presupuesto
        </h2>

        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Ppto 2026 v1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sap"
              checked={sapEnabled}
              onChange={(e) => setSapEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="sap" className="text-sm text-gray-700">
              Modo SAP habilitado
            </label>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="precios-fijos"
              checked={preciosFijos}
              onChange={(e) => setPreciosFijos(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="precios-fijos" className="text-sm text-gray-700">
              Modo Sin Consolidar
              <span className="block text-xs text-gray-500">Usar precios fijos para Prehomo y Caliza Triturada</span>
            </label>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded">
            Período fijo: Sep 2025 – Ago 2026 (12 meses)
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear versión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
