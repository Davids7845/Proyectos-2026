"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Report {
  precios_insertados: number;
  porcentajes_insertados: number;
  recetas_creadas: number;
  receta_lineas_insertadas: number;
  humedades_insertadas: number;
  materiales_no_encontrados: string[];
  errores: Array<{ seccion: string; row_excel: number | null; mensaje: string }>;
}

export default function ImportForm({ versionId, disabled }: { versionId: string; disabled: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [periodos, setPeriodos] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/versiones/${versionId}/import`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setReport(json.report);
      setPeriodos(json.parsed?.periodos ?? []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Archivo Excel (.xlsx)</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled || loading}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!file || loading || disabled}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Importando…" : "Importar"}
          </button>
          {file && <span className="text-xs text-gray-500">{file.name} ({Math.round(file.size / 1024)} KB)</span>}
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Reporte de importación</h2>
          {periodos.length > 0 && (
            <p className="text-xs text-gray-500">
              Periodos detectados: <span className="tabular-nums">{periodos.join(", ")}</span>
            </p>
          )}
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Precios insertados: <strong>{report.precios_insertados}</strong></li>
            <li>% Consumo insertados: <strong>{report.porcentajes_insertados}</strong></li>
            <li>Recetas creadas: <strong>{report.recetas_creadas}</strong> ({report.receta_lineas_insertadas} líneas)</li>
            <li>Humedades insertadas: <strong>{report.humedades_insertadas}</strong></li>
          </ul>

          {report.materiales_no_encontrados.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-yellow-700 mb-1">
                Materiales no encontrados ({report.materiales_no_encontrados.length}) — no se insertaron sus filas:
              </p>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
                {report.materiales_no_encontrados.slice(0, 30).map((n) => <li key={n}>{n}</li>)}
                {report.materiales_no_encontrados.length > 30 && (
                  <li className="italic">… y {report.materiales_no_encontrados.length - 30} más</li>
                )}
              </ul>
            </div>
          )}

          {report.errores.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-red-700 mb-1">Errores ({report.errores.length}):</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {report.errores.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    [{e.seccion}{e.row_excel ? `:fila ${e.row_excel}` : ""}] {e.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => router.push(`/versiones/${versionId}/datos/precios`)}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver precios importados →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
