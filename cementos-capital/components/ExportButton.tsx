"use client";

import { useState } from "react";

export default function ExportButton({ versionId }: { versionId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/versiones/${versionId}/export`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "presupuesto.xlsx";
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? "Error al exportar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col items-end">
      <button
        onClick={handleExport}
        disabled={loading}
        className="text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded px-3 py-1.5"
      >
        {loading ? "Exportando…" : "Exportar a Excel"}
      </button>
      {error && <span className="text-xs text-red-600 mt-1">{error}</span>}
    </span>
  );
}
