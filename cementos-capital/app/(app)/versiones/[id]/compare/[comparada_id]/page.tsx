"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { WaterfallItem } from "@/components/charts/WaterfallChart";

const WaterfallChart = dynamic(() => import("@/components/charts/WaterfallChart"), { ssr: false });

const PRODUCTOS = [
  { key: "clinker",       label: "Clinker (ORD 5)" },
  { key: "cemento-ug",    label: "Cemento UG (ORD 6)" },
  { key: "cemento-art",   label: "Cemento ART (ORD 7)" },
  { key: "fibrocemento",  label: "Fibrocemento (ORD 16)" },
];

interface WaterfallApiResponse {
  proceso: string;
  items: Array<{ label: string; baseValue: number; compValue: number; delta: number }>;
  totales: { base: number; comp: number; delta: number };
}

export default function ComparePage() {
  const { id: base_id, comparada_id } = useParams() as { id: string; comparada_id: string };
  const [data, setData] = useState<Record<string, WaterfallApiResponse | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled(
          PRODUCTOS.map(p =>
            fetch(`/api/versiones/compare/${base_id}/${comparada_id}/waterfall/${p.key}`)
              .then(r => r.json() as Promise<WaterfallApiResponse>)
          )
        );
        const map: Record<string, WaterfallApiResponse | null> = {};
        for (let i = 0; i < PRODUCTOS.length; i++) {
          const r = results[i];
          map[PRODUCTOS[i].key] = r.status === "fulfilled" ? r.value : null;
        }
        setData(map);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [base_id, comparada_id]);

  function buildWaterfallItems(resp: WaterfallApiResponse): WaterfallItem[] {
    const items: WaterfallItem[] = [
      { label: "Base", value: 0, base: resp.totales.base, comp: resp.totales.base, isTotal: true },
      ...resp.items
        .filter(it => Math.abs(it.delta) > 1)
        .slice(0, 12)
        .map(it => ({
          label: it.label,
          value: it.delta,
          base: it.baseValue,
          comp: it.compValue,
          isTotal: false,
        })),
      { label: "Comparada", value: 0, base: resp.totales.comp, comp: resp.totales.comp, isTotal: true },
    ];
    return items;
  }

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${base_id}`} className="hover:underline">{base_id}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Comparativa</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Comparativa de versiones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Waterfall: diferencia de costo COP/Ton por componente
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 bg-red-400 rounded-sm" />
            Sube el costo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 bg-green-400 rounded-sm" />
            Baja el costo
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
          <span className="ml-3 text-sm text-gray-500">Cargando comparativa…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {PRODUCTOS.map(p => {
            const resp = data[p.key];
            if (!resp || resp.items?.length === 0) {
              return (
                <div key={p.key} className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{p.label}</h3>
                  <p className="text-sm text-gray-400">Sin datos para este producto en una o ambas versiones.</p>
                </div>
              );
            }

            const items = buildWaterfallItems(resp);
            const delta = resp.totales.delta;
            const deltaStr = (delta >= 0 ? "+" : "") + delta.toLocaleString("es-CO", { maximumFractionDigits: 0 });

            return (
              <div key={p.key}>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="text-xs text-gray-500">
                    Base: {resp.totales.base.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP/Ton
                  </span>
                  <span className="text-xs text-gray-500">→</span>
                  <span className="text-xs text-gray-500">
                    Comp: {resp.totales.comp.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP/Ton
                  </span>
                  <span className={`text-xs font-semibold ${delta >= 0 ? "text-red-600" : "text-green-600"}`}>
                    {deltaStr} COP/Ton
                  </span>
                </div>
                <WaterfallChart
                  items={items}
                  title={p.label}
                  unidad="COP/Ton"
                />

                {/* Tabla de desglose */}
                <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Concepto</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Base</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Comparada</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resp.items.slice(0, 12).map((it, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-3 py-1.5 text-gray-700">{it.label}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {it.baseValue.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {it.compValue.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                            it.delta >= 0 ? "text-red-600" : "text-green-600"
                          }`}>
                            {(it.delta >= 0 ? "+" : "") + it.delta.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
