"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Summary {
  runId: string;
  estado: "exitoso" | "error";
  duracion_ms: number;
  total_calculos: number;
  procesos_calculados: number;
  procesos_omitidos: Array<{ ord: number; razon: string }>;
  error_msg: string | null;
}

export default function CalcularButton({ versionId, estado }: { versionId: string; estado: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = loading || estado === "congelado" || estado === "archivado" || estado === "calculando";

  async function handleClick() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(`/api/versiones/${versionId}/calcular`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setSummary(json);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={handleClick}
        disabled={disabled}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Calculando…" : "Ejecutar cálculo"}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {summary && (
        <p className="text-xs text-gray-500 mt-2">
          {summary.estado === "exitoso" ? "✓" : "✗"} {summary.procesos_calculados} procesos · {summary.total_calculos} cálculos · {summary.duracion_ms}ms
          {summary.procesos_omitidos.length > 0 && ` · ${summary.procesos_omitidos.length} omitidos`}
        </p>
      )}
    </div>
  );
}
