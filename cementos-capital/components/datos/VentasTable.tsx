"use client";

import { useMemo } from "react";

interface Venta {
  id: string;
  material_id: string;
  presentacion: string | null;
  periodo: string;
  cantidad_ton: number;
  precio_venta: number | null;
}

interface Material {
  id: string;
  codigo: string;
  nombre: string;
}

interface Props {
  ventas: Venta[];
  materiales: Material[];
  periodos: string[];
}

function formatPeriodoHeader(p: string): string {
  const d = new Date(p);
  const mes = d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" });
  return `${mes.replace(".", "")}-${String(d.getUTCFullYear()).slice(2)}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

export default function VentasTable({ ventas, materiales, periodos }: Props) {
  const matById = useMemo(() => new Map(materiales.map(m => [m.id, m])), [materiales]);

  type RowKey = string;
  interface PivotRow {
    rowKey: RowKey;
    material_id: string;
    presentacion: string | null;
    cells: Map<string, number>;
  }

  const rows = useMemo<PivotRow[]>(() => {
    const map = new Map<RowKey, PivotRow>();
    for (const v of ventas) {
      const k = `${v.material_id}||${v.presentacion ?? ""}`;
      let row = map.get(k);
      if (!row) {
        row = { rowKey: k, material_id: v.material_id, presentacion: v.presentacion, cells: new Map() };
        map.set(k, row);
      }
      row.cells.set(v.periodo, Number(v.cantidad_ton));
    }
    return Array.from(map.values()).sort((a, b) => {
      const na = matById.get(a.material_id)?.nombre ?? "";
      const nb = matById.get(b.material_id)?.nombre ?? "";
      return na.localeCompare(nb);
    });
  }, [ventas, matById]);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-sm">No hay ventas proyectadas todavía.</p>
      </div>
    );
  }

  // Total por periodo
  const totales = new Map<string, number>();
  for (const p of periodos) {
    let t = 0;
    for (const r of rows) t += r.cells.get(p) ?? 0;
    totales.set(p, t);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
      <table className="text-sm w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
              SKU
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Presentación</th>
            {periodos.map(p => (
              <th key={p} className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">
                {formatPeriodoHeader(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const mat = matById.get(r.material_id);
            return (
              <tr key={r.rowKey} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">
                  {mat?.nombre ?? r.material_id}
                  {mat?.codigo && <span className="ml-1 text-xs text-gray-400 font-normal">{mat.codigo}</span>}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{r.presentacion ?? "—"}</td>
                {periodos.map(p => {
                  const v = r.cells.get(p);
                  return (
                    <td key={p} className="px-3 py-2 text-right tabular-nums text-gray-700">
                      {v != null ? fmtNum(v) : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
          <tr>
            <td colSpan={2} className="px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-gray-50 z-10">
              Total (Ton)
            </td>
            {periodos.map(p => (
              <td key={p} className="px-3 py-2 text-right tabular-nums font-semibold text-gray-800">
                {fmtNum(totales.get(p) ?? 0)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
