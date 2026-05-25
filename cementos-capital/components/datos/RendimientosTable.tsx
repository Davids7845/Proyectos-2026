"use client";

import { useMemo } from "react";

interface Rendimiento {
  id: string;
  proceso_id: string;
  periodo: string;
  horas_mes: number | null;
  produccion_ton: number | null;
  horas_operacion_efectivas: number | null;
  rendimiento_ton_hr: number | null;
  disponibilidad: number | null;
  utilizacion: number | null;
  oee: number | null;
}

interface Proceso {
  id: string;
  ord: number;
  nombre: string;
  material: string;
}

interface Props {
  rendimientos: Rendimiento[];
  procesos: Proceso[];
  periodos: string[];
}

function formatPeriodoHeader(p: string): string {
  const d = new Date(p);
  const mes = d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" });
  return `${mes.replace(".", "")}-${String(d.getUTCFullYear()).slice(2)}`;
}

function fmtNum(n: number | null, decimales = 0): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: decimales }).format(n);
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

type Campo = {
  label: string;
  key: keyof Rendimiento;
  fmt: (v: number | null) => string;
  unidad: string;
};

const CAMPOS: Campo[] = [
  { label: "Horas mes",         key: "horas_mes",                  fmt: v => fmtNum(v, 0), unidad: "h" },
  { label: "Producción",        key: "produccion_ton",             fmt: v => fmtNum(v, 0), unidad: "Ton/mes" },
  { label: "Horas operación",   key: "horas_operacion_efectivas",  fmt: v => fmtNum(v, 1), unidad: "h" },
  { label: "Rendimiento",       key: "rendimiento_ton_hr",         fmt: v => fmtNum(v, 1), unidad: "Ton/h" },
  { label: "Disponibilidad",    key: "disponibilidad",             fmt: fmtPct,            unidad: "%" },
  { label: "Utilización",       key: "utilizacion",                fmt: fmtPct,            unidad: "%" },
  { label: "OEE",               key: "oee",                        fmt: fmtPct,            unidad: "%" },
];

export default function RendimientosTable({ rendimientos, procesos, periodos }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const procById = useMemo(() => new Map(procesos.map(p => [p.id, p])), [procesos]);

  const byProcPeriodo = useMemo(() => {
    const map = new Map<string, Rendimiento>();
    for (const r of rendimientos) map.set(`${r.proceso_id}|${r.periodo}`, r);
    return map;
  }, [rendimientos]);

  const procesosConDatos = useMemo(() => {
    const ids = new Set(rendimientos.map(r => r.proceso_id));
    return procesos.filter(p => ids.has(p.id)).sort((a, b) => a.ord - b.ord);
  }, [rendimientos, procesos]);

  if (procesosConDatos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-sm">No hay rendimientos cargados todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {procesosConDatos.map(proc => (
        <div key={proc.id} className="bg-white border border-gray-200 rounded-lg overflow-auto">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-800">
              ORD {proc.ord} — {proc.nombre}
            </h3>
          </div>
          <table className="text-sm w-full">
            <thead className="bg-gray-50/50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 min-w-[180px]">Campo</th>
                {periodos.map(p => (
                  <th key={p} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">
                    {formatPeriodoHeader(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAMPOS.map(campo => (
                <tr key={campo.key} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-700">
                    {campo.label}
                    <span className="ml-1 text-xs text-gray-400 font-normal">{campo.unidad}</span>
                  </td>
                  {periodos.map(per => {
                    const r = byProcPeriodo.get(`${proc.id}|${per}`);
                    const v = r ? (r[campo.key] as number | null) : null;
                    return (
                      <td key={per} className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {campo.fmt(v != null ? Number(v) : null)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
