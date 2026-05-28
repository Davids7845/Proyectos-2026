"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/ui/colors";

// Convierte "YYYY-MM" → "YYYY-MM-01" (formato DATE).
function monthInputToDate(s: string): string {
  return `${s}-01`;
}

// Cuenta meses inclusivos entre dos "YYYY-MM-01".
function countMonths(inicio: string, fin: string): number {
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fin}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
}

function formatRango(inicio: string, fin: string): string {
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fin}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric", timeZone: "UTC" };
  return `${a.toLocaleDateString("es-CO", opts)} → ${b.toLocaleDateString("es-CO", opts)}`;
}

export default function NuevaVersionButton() {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [sapEnabled, setSapEnabled] = useState(false);
  const [preciosFijos, setPreciosFijos] = useState(false);
  // Default: Sep 2025 → Dic 2026 (16 meses, alineado con Excel Nueva_Plantilla_Ppto_CV_V2)
  const [mesInicio, setMesInicio] = useState("2025-09");
  const [mesFin, setMesFin] = useState("2026-12");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fechaInicioISO = monthInputToDate(mesInicio);
  const fechaFinISO    = monthInputToDate(mesFin);
  const meses = countMonths(fechaInicioISO, fechaFinISO);
  const rangoOk = meses >= 1;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!rangoOk) {
      setError("La fecha de fin debe ser igual o posterior a la de inicio.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("budget_versions").insert({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      estado: "borrador",
      sap_enabled: sapEnabled,
      precios_fijos: preciosFijos,
      periodo_inicio: fechaInicioISO,
      periodo_fin: fechaFinISO,
      fecha_inicio: fechaInicioISO,
      fecha_fin: fechaFinISO,
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
        className="px-4 py-2 text-white text-sm font-medium rounded hover:opacity-90"
        style={{ backgroundColor: BRAND.primary }}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mes inicio *</label>
              <input
                type="month"
                required
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mes fin *</label>
              <input
                type="month"
                required
                value={mesFin}
                onChange={(e) => setMesFin(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div
            className="text-xs px-3 py-2 rounded"
            style={{
              backgroundColor: rangoOk ? BRAND.primarySoft : "#FEF2F2",
              color: rangoOk ? BRAND.ink : "#991B1B",
            }}
          >
            {rangoOk ? (
              <>
                <strong>{meses}</strong> meses · {formatRango(fechaInicioISO, fechaFinISO)}
              </>
            ) : (
              "La fecha de fin debe ser igual o posterior a la de inicio."
            )}
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
              disabled={loading || !rangoOk}
              className="px-4 py-2 text-sm text-white rounded hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: BRAND.primary }}
            >
              {loading ? "Creando..." : "Crear versión"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
