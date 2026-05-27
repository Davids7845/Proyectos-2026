"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { WaterfallItem } from "@/components/charts/WaterfallChart";
import { BRAND, formatCOP } from "@/lib/ui/colors";

const WaterfallChart = dynamic(() => import("@/components/charts/WaterfallChart"), { ssr: false });

const PRODUCTOS = [
  { key: "clinker",      label: "Clinker",      ord: 5  },
  { key: "cemento-ug",   label: "Cemento UG",   ord: 6  },
  { key: "cemento-art",  label: "Cemento ART",  ord: 7  },
  { key: "fibrocemento", label: "Fibrocemento", ord: 16 },
];

interface WaterfallApiResponse {
  proceso: string;
  items: Array<{ label: string; baseValue: number; compValue: number; delta: number }>;
  totales: { base: number; comp: number; delta: number };
}

interface VersionRow {
  id: string;
  nombre: string;
}

export default function GraficasPage() {
  const { id: baseId } = useParams() as { id: string };
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const compareId = sp.get("compare") ?? "";

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [thisVersion, setThisVersion] = useState<VersionRow | null>(null);
  const [data, setData] = useState<Record<string, WaterfallApiResponse | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("budget_versions")
      .select("id, nombre")
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => {
        const all = (rows ?? []) as VersionRow[];
        setVersions(all.filter(v => v.id !== baseId));
        setThisVersion(all.find(v => v.id === baseId) ?? null);
      });
  }, [baseId]);

  useEffect(() => {
    if (!compareId) {
      setData({});
      return;
    }
    setLoading(true);
    Promise.allSettled(
      PRODUCTOS.map(p =>
        fetch(`/api/versiones/compare/${baseId}/${compareId}/waterfall/${p.key}`)
          .then(r => r.json() as Promise<WaterfallApiResponse>)
      )
    ).then(results => {
      const map: Record<string, WaterfallApiResponse | null> = {};
      for (let i = 0; i < PRODUCTOS.length; i++) {
        const r = results[i];
        map[PRODUCTOS[i].key] = r.status === "fulfilled" ? r.value : null;
      }
      setData(map);
      setLoading(false);
    });
  }, [baseId, compareId]);

  const buildItems = (resp: WaterfallApiResponse): WaterfallItem[] => [
    { label: "Base", value: 0, base: resp.totales.base, comp: resp.totales.base, isTotal: true },
    ...resp.items
      .filter(it => Math.abs(it.delta) > 1)
      .slice(0, 10)
      .map(it => ({
        label: it.label,
        value: it.delta,
        base: it.baseValue,
        comp: it.compValue,
        isTotal: false,
      })),
    { label: "Comparada", value: 0, base: resp.totales.comp, comp: resp.totales.comp, isTotal: true },
  ];

  // Resumen consolidado (suma de productos)
  const resumen = useMemo(() => {
    const respuestas = Object.values(data).filter((d): d is WaterfallApiResponse => d != null);
    if (respuestas.length === 0) return null;
    const totalBase = respuestas.reduce((s, r) => s + r.totales.base, 0);
    const totalComp = respuestas.reduce((s, r) => s + r.totales.comp, 0);

    // Driver principal
    let topDriver: { label: string; delta: number; producto: string } | null = null;
    for (const [key, resp] of Object.entries(data)) {
      if (!resp) continue;
      const producto = PRODUCTOS.find(p => p.key === key)?.label ?? key;
      for (const it of resp.items) {
        if (!topDriver || Math.abs(it.delta) > Math.abs(topDriver.delta)) {
          topDriver = { label: it.label, delta: it.delta, producto };
        }
      }
    }
    return { totalBase, totalComp, deltaTotal: totalComp - totalBase, topDriver };
  }, [data]);

  function handleSelectCompare(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    const params = new URLSearchParams(sp.toString());
    if (v) params.set("compare", v);
    else params.delete("compare");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + título */}
      <div>
        <nav className="text-xs flex items-center gap-1 mb-3" style={{ color: BRAND.inkSecondary }}>
          <Link href="/versiones" className="hover:underline">Versiones</Link>
          <span>/</span>
          <Link href={`/versiones/${baseId}`} className="hover:underline">{thisVersion?.nombre ?? "…"}</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: BRAND.ink }}>Gráficas</span>
        </nav>
        <header className="pb-4 border-b flex flex-wrap items-end justify-between gap-4" style={{ borderColor: BRAND.border }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Gráficas comparativas</h1>
            <p className="text-sm mt-1" style={{ color: BRAND.inkSecondary }}>
              Waterfall de costo COP/Ton por producto — diferencia entre dos versiones
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide font-medium block mb-1" style={{ color: BRAND.inkMuted }}>
              Comparar con
            </label>
            <select
              value={compareId}
              onChange={handleSelectCompare}
              className="text-sm px-3 py-2 rounded-lg border bg-white"
              style={{ borderColor: BRAND.border, color: BRAND.ink, minWidth: 220 }}
            >
              <option value="">— Selecciona una versión —</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>
        </header>
      </div>

      {!compareId && (
        <div className="bg-white border rounded-xl shadow-sm p-12 text-center" style={{ borderColor: BRAND.border }}>
          <p className="text-sm" style={{ color: BRAND.inkSecondary }}>
            Selecciona una versión arriba para ver la comparativa.
          </p>
        </div>
      )}

      {compareId && loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: BRAND.primary }} />
          <span className="ml-3 text-sm" style={{ color: BRAND.inkSecondary }}>Cargando comparativa…</span>
        </div>
      )}

      {compareId && !loading && resumen && (
        <div className="bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border, borderTop: `4px solid ${BRAND.primary}` }}>
          <p className="text-xs uppercase tracking-wide font-medium mb-3" style={{ color: BRAND.inkMuted }}>
            Variación total del costo (suma de los 4 productos)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs" style={{ color: BRAND.inkMuted }}>Base</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: BRAND.ink }}>{formatCOP(resumen.totalBase)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: BRAND.inkMuted }}>Comparada</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: BRAND.ink }}>{formatCOP(resumen.totalComp)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: BRAND.inkMuted }}>Δ Total</p>
              <p
                className="text-2xl font-bold tabular-nums"
                style={{ color: resumen.deltaTotal >= 0 ? BRAND.danger : BRAND.success }}
              >
                {resumen.deltaTotal >= 0 ? "+" : ""}{formatCOP(resumen.deltaTotal)}
              </p>
              {resumen.topDriver && (
                <p className="text-xs mt-1" style={{ color: BRAND.inkSecondary }}>
                  Driver: <span className="font-medium">{resumen.topDriver.label}</span> ({resumen.topDriver.producto}){" "}
                  <span style={{ color: resumen.topDriver.delta >= 0 ? BRAND.danger : BRAND.success }}>
                    {resumen.topDriver.delta >= 0 ? "+" : ""}{formatCOP(resumen.topDriver.delta)}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {compareId && !loading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {PRODUCTOS.map(p => {
            const resp = data[p.key];
            if (!resp || resp.items?.length === 0) {
              return (
                <div key={p.key} className="bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border }}>
                  <h3 className="text-base font-semibold mb-2" style={{ color: BRAND.ink }}>{p.label}</h3>
                  <p className="text-sm" style={{ color: BRAND.inkMuted }}>
                    Sin datos para este producto en una o ambas versiones.
                  </p>
                </div>
              );
            }
            const items = buildItems(resp);
            const delta = resp.totales.delta;
            const topItem = resp.items.length > 0 ? resp.items[0] : null;
            return (
              <div key={p.key}>
                <WaterfallChart items={items} title={p.label} unidad="COP/Ton" />
                {topItem && (
                  <div className="mt-2 px-1 text-xs flex items-center justify-between" style={{ color: BRAND.inkSecondary }}>
                    <span>
                      Δ total: <span className="font-semibold tabular-nums" style={{ color: delta >= 0 ? BRAND.danger : BRAND.success }}>
                        {delta >= 0 ? "+" : ""}{formatCOP(delta)}
                      </span>
                    </span>
                    <span>
                      Driver: <span className="font-medium">{topItem.label}</span>{" "}
                      <span style={{ color: topItem.delta >= 0 ? BRAND.danger : BRAND.success }} className="tabular-nums">
                        ({topItem.delta >= 0 ? "+" : ""}{formatCOP(topItem.delta)})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
