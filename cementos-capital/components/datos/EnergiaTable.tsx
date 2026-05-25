"use client";

import { useMemo } from "react";

interface Param {
  id: string;
  periodo: string;
  precio_contrato: number | null;
  precio_restricciones: number | null;
  cargos_fijos: number | null;
  kwh_ton_proceso: Record<string, number> | null;
  pci_combustibles: Record<string, number> | null;
  kcal_tck_total: number | null;
  pci_ponderado_horno: number | null;
}

interface Props {
  parametros: Param[];
  periodos: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatPeriodoHeader(p: string): string {
  const d = new Date(p);
  const mes = d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" });
  return `${mes.replace(".", "")}-${String(d.getUTCFullYear()).slice(2)}`;
}

function fmtNum(n: number | null, decimales = 2): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: decimales }).format(n);
}

export default function EnergiaTable({ parametros, periodos }: Props) {
  const byPeriodo = useMemo(() => new Map(parametros.map(p => [p.periodo, p])), [parametros]);

  // Procesos detectados en cualquier kwh_ton_proceso
  const procesosKwh = useMemo(() => {
    const set = new Set<string>();
    for (const p of parametros) {
      if (p.kwh_ton_proceso) for (const k of Object.keys(p.kwh_ton_proceso)) set.add(k);
    }
    return Array.from(set).sort();
  }, [parametros]);

  // Proveedores detectados en pci_combustibles
  const proveedoresPCI = useMemo(() => {
    const set = new Set<string>();
    for (const p of parametros) {
      if (p.pci_combustibles) for (const k of Object.keys(p.pci_combustibles)) set.add(k);
    }
    return Array.from(set).sort();
  }, [parametros]);

  if (parametros.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-sm">No hay parámetros energéticos cargados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Precios kWh ─── */}
      <Section title="Precios Energía Eléctrica (COP/kWh)">
        <Row label="Precio Contrato"      periodos={periodos} get={p => byPeriodo.get(p)?.precio_contrato} />
        <Row label="Restricciones / Conexión" periodos={periodos} get={p => byPeriodo.get(p)?.precio_restricciones} />
        <Row label="Cargos Fijos / Admin" periodos={periodos} get={p => byPeriodo.get(p)?.cargos_fijos} />
        <Row label="TOTAL (suma)"         periodos={periodos} get={p => {
          const r = byPeriodo.get(p);
          if (!r) return null;
          return (r.precio_contrato ?? 0) + (r.precio_restricciones ?? 0) + (r.cargos_fijos ?? 0);
        }} bold />
      </Section>

      {/* ─── Consumo kWh/Ton por proceso ─── */}
      {procesosKwh.length > 0 && (
        <Section title="Consumo Eléctrico por proceso (kWh/Ton)">
          {procesosKwh.map(proc => (
            <Row key={proc} label={proc} periodos={periodos} get={p => byPeriodo.get(p)?.kwh_ton_proceso?.[proc] ?? null} />
          ))}
        </Section>
      )}

      {/* ─── Energía térmica ─── */}
      <Section title="Energía Térmica (Horno)">
        <Row label="Kcal Total Horno"          periodos={periodos} get={p => byPeriodo.get(p)?.kcal_tck_total}      decimales={0} />
        <Row label="PCI Ponderado Horno"       periodos={periodos} get={p => byPeriodo.get(p)?.pci_ponderado_horno} decimales={0} />
      </Section>

      {/* ─── PCI por proveedor ─── */}
      {proveedoresPCI.length > 0 && (
        <Section title="PCI Combustibles por proveedor (Kcal/Ton)">
          {proveedoresPCI.map(pv => (
            <Row key={pv} label={pv} periodos={periodos} get={p => byPeriodo.get(p)?.pci_combustibles?.[pv] ?? null} decimales={0} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-800">{title}</h3>
      </div>
      <table className="text-sm w-full">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({
  label, periodos, get, bold, decimales = 2,
}: {
  label: string;
  periodos: string[];
  get: (periodo: string) => number | null | undefined;
  bold?: boolean;
  decimales?: number;
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className={`px-3 py-2 min-w-[220px] ${bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>
        {label}
      </td>
      {periodos.map(p => {
        const v = get(p);
        return (
          <td key={p} className={`px-3 py-2 text-right tabular-nums ${bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">{periodos.length > 6 ? "" : ""}</span>
              {fmtNum(v ?? null, decimales)}
            </div>
          </td>
        );
      })}
    </tr>
  );
}
