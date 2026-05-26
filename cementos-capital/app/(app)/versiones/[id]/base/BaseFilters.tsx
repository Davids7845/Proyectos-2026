"use client";

import { useRouter } from "next/navigation";

interface BaseFiltersProps {
  versionId: string;
  periodos: string[];
  procesos: Array<{ id: string; ord: number; nombre: string }>;
  currentTipo: string;
  currentPeriodo: string;
  currentOrd: string;
}

function fmtPeriodo(p: string) {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", {
    month: "short", year: "2-digit", timeZone: "UTC",
  });
}

export default function BaseFilters({
  versionId, periodos, procesos,
  currentTipo, currentPeriodo, currentOrd,
}: BaseFiltersProps) {
  const router = useRouter();

  function navigate(overrides: Record<string, string>) {
    const values: Record<string, string> = {
      tipo: currentTipo,
      periodo: currentPeriodo,
      ord: currentOrd,
      ...overrides,
      page: "1",
    };
    const filtered = Object.entries(values).filter(([, v]) => v && v !== "0");
    const qs = new URLSearchParams(filtered).toString();
    router.push(`/versiones/${versionId}/base${qs ? `?${qs}` : ""}`);
  }

  const hasFilters = currentTipo || currentPeriodo || currentOrd;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        value={currentTipo}
        onChange={(e) => navigate({ tipo: e.target.value })}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
      >
        <option value="">Todos los tipos</option>
        <option value="entrada">Entrada</option>
        <option value="traslado">Traslado</option>
      </select>

      <select
        value={currentPeriodo}
        onChange={(e) => navigate({ periodo: e.target.value })}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
      >
        <option value="">Todos los períodos</option>
        {periodos.map(p => (
          <option key={p} value={p}>{fmtPeriodo(p)}</option>
        ))}
      </select>

      <select
        value={currentOrd}
        onChange={(e) => navigate({ ord: e.target.value })}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
      >
        <option value="">Todos los procesos</option>
        {procesos.map(p => (
          <option key={p.id} value={String(p.ord)}>{p.ord} — {p.nombre}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => navigate({ tipo: "", periodo: "", ord: "" })}
          className="text-sm text-red-600 hover:underline px-2 py-1.5"
        >
          Limpiar filtros ×
        </button>
      )}
    </div>
  );
}
