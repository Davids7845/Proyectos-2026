"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

interface RunInfo {
  id: string;
  iniciado_en: string;
  total_calculos: number;
}

interface Props {
  años: number[];
  meses: { value: string; label: string }[];
  runs: RunInfo[];
  currentAño: string;
  currentMes: string;
  versionId: string;
}

const MES_LABEL: Record<string, string> = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril",
  "05":"Mayo","06":"Junio","07":"Julio","08":"Agosto",
  "09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre",
};

export default function DesviacionesFilters({
  años, meses, runs, currentAño, currentMes, versionId,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const [pending, startTransition] = useTransition();
  const fileRef    = useRef<HTMLInputElement>(null);
  const periodoRef = useRef<HTMLSelectElement>(null);
  const runRef        = useRef<HTMLSelectElement>(null);
  const runPeriodoRef = useRef<HTMLSelectElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [copyingRun, setCopyingRun] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  function navigate(año: string, mes: string) {
    const p = new URLSearchParams(sp.toString());
    año ? p.set("año", año) : p.delete("año");
    mes  ? p.set("mes",  mes)  : p.delete("mes");
    startTransition(() => router.push(`${pathname}?${p}`));
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    const periodoVal = periodoRef.current?.value;
    if (!file)       { setImportMsg("Selecciona un archivo Excel"); return; }
    if (!periodoVal) { setImportMsg("Selecciona el período del archivo"); return; }

    setImporting(true);
    setImportMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("periodo", periodoVal);

    try {
      const res  = await fetch(`/api/versiones/${versionId}/costos-reales`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setImportMsg(`Error: ${json.error ?? res.statusText}`);
      } else {
        const r = json.report;
        setImportMsg(
          `✓ ${r.insertadas} filas cargadas para ${periodoVal}` +
          (r.omitidas   ? ` · ${r.omitidas} omitidas`       : "") +
          (r.errores?.length ? ` · ${r.errores.length} errores` : "")
        );
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setImportMsg(`Error de red: ${String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleCopyFromCalc() {
    const runId = runRef.current?.value;
    const periodoVal = runPeriodoRef.current?.value || undefined;
    if (!runId) { setCopyMsg("Selecciona un run"); return; }

    setCopyingRun(true);
    setCopyMsg(null);

    try {
      const res = await fetch(`/api/versiones/${versionId}/costos-reales/from-calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, periodo: periodoVal }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCopyMsg(`Error: ${json.error ?? res.statusText}`);
      } else {
        const r = json.report;
        const ps = r.periodos_procesados?.join(", ") ?? "—";
        setCopyMsg(
          `✓ ${r.insertadas} filas (períodos: ${ps})` +
          (r.omitidas        ? ` · ${r.omitidas} omitidas`        : "") +
          (r.errores?.length ? ` · ${r.errores.length} errores`   : "")
        );
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setCopyMsg(`Error de red: ${String(e)}`);
    } finally {
      setCopyingRun(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filtros período */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Período:</span>
        <select
          value={currentAño}
          onChange={e => navigate(e.target.value, currentMes)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="">Todos los años</option>
          {años.map(a => <option key={a} value={String(a)}>{a}</option>)}
        </select>
        <select
          value={currentMes}
          onChange={e => navigate(currentAño, e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="">Todos los meses</option>
          {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {pending && <span className="text-xs text-gray-400">cargando…</span>}
      </div>

      {/* Importar reales */}
      <details className="border border-gray-200 rounded p-3 text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">
          Cargar costos reales desde Excel
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-600 w-20 shrink-0">Período:</span>
            <select
              ref={periodoRef}
              className="text-sm border border-gray-300 rounded px-2 py-1"
              defaultValue=""
            >
              <option value="" disabled>Selecciona mes-año</option>
              {años.flatMap(a =>
                Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, "0");
                  return (
                    <option key={`${a}-${m}`} value={`${a}-${m}`}>
                      {MES_LABEL[m]} {a}
                    </option>
                  );
                })
              )}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-600 w-20 shrink-0">Archivo:</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="text-sm" />
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="self-start mt-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? "Cargando…" : "Importar"}
          </button>
          {importMsg && (
            <p className={`text-sm ${importMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
              {importMsg}
            </p>
          )}
        </div>
      </details>

      {/* Usar resultado del motor como reales */}
      <details className="border border-gray-200 rounded p-3 text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">
          Usar run del motor como datos reales
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          {runs.length === 0 ? (
            <p className="text-gray-500">
              No hay runs completados en esta versión. Corre el motor primero
              en la pestaña <em>Calcular</em>.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Toma los costos del motor de un run y los copia a la tabla de
                reales (COP/Ton). Útil si los datos importados ya representan
                el escenario real (precios y rendimientos reales).
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-600 w-20 shrink-0">Run:</span>
                <select ref={runRef} className="text-sm border border-gray-300 rounded px-2 py-1" defaultValue="">
                  <option value="" disabled>Selecciona un run</option>
                  {runs.map(r => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.iniciado_en).toLocaleString("es-CO")} · {r.total_calculos} cálculos
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-600 w-20 shrink-0">Período:</span>
                <select ref={runPeriodoRef} className="text-sm border border-gray-300 rounded px-2 py-1" defaultValue="">
                  <option value="">Todos los del run</option>
                  {años.flatMap(a =>
                    Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, "0");
                      return (
                        <option key={`${a}-${m}`} value={`${a}-${m}`}>
                          {MES_LABEL[m]} {a}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
              <button
                onClick={handleCopyFromCalc}
                disabled={copyingRun}
                className="self-start mt-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {copyingRun ? "Copiando…" : "Copiar a reales"}
              </button>
              {copyMsg && (
                <p className={`text-sm ${copyMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
                  {copyMsg}
                </p>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  );
}
