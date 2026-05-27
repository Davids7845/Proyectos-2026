"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BRAND, formatCOP } from "@/lib/ui/colors";

const PRODUCTOS = [
  { key: "clinker",      label: "Clinkerización",         ord: 5  },
  { key: "cemento-ug",   label: "Cemento UG",             ord: 6  },
  { key: "cemento-art",  label: "Cemento ART",            ord: 7  },
  { key: "fibrocemento", label: "Fibrocemento",           ord: 16 },
];

interface WaterfallApiResponse {
  proceso: string;
  items: Array<{ label: string; baseValue: number; compValue: number; delta: number }>;
  totales: { base: number; comp: number; delta: number };
}

interface VersionRow { id: string; nombre: string; }

export default function ArrastradoPage() {
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

  function handleSelectCompare(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    const params = new URLSearchParams(sp.toString());
    if (v) params.set("compare", v);
    else params.delete("compare");
    router.push(`${pathname}?${params.toString()}`);
  }

  const compareVersion = versions.find(v => v.id === compareId);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-xs flex items-center gap-1 mb-3" style={{ color: BRAND.inkSecondary }}>
          <Link href="/versiones" className="hover:underline">Versiones</Link>
          <span>/</span>
          <Link href={`/versiones/${baseId}`} className="hover:underline">{thisVersion?.nombre ?? "…"}</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: BRAND.ink }}>Costo Arrastrado</span>
        </nav>
        <header className="pb-4 border-b flex flex-wrap items-end justify-between gap-4" style={{ borderColor: BRAND.border }}>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Costo arrastrado</h1>
            <p className="text-sm mt-1" style={{ color: BRAND.inkSecondary }}>
              Bridge entre versiones: descomposición Δ precio vs Δ consumo por componente
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
            Selecciona una versión arriba para ver el costo arrastrado.
          </p>
        </div>
      )}

      {compareId && loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: BRAND.primary }} />
          <span className="ml-3 text-sm" style={{ color: BRAND.inkSecondary }}>Cargando datos…</span>
        </div>
      )}

      {compareId && !loading && PRODUCTOS.map(p => {
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
        const delta = resp.totales.delta;
        const deltaPct = resp.totales.base > 0 ? (delta / resp.totales.base) * 100 : 0;
        return (
          <div key={p.key} className="bg-white border rounded-xl shadow-sm overflow-hidden" style={{ borderColor: BRAND.border, borderTop: `4px solid ${BRAND.primary}` }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: BRAND.border }}>
              <h3 className="text-lg font-bold" style={{ color: BRAND.ink }}>{p.label}</h3>
              <p className="text-xs mt-0.5" style={{ color: BRAND.inkMuted }}>Proceso N° {String(p.ord).padStart(2, "0")}</p>
            </div>

            <div className="grid grid-cols-3 gap-6 px-6 py-5 border-b" style={{ borderColor: BRAND.border, backgroundColor: BRAND.bgSubtle }}>
              <div>
                <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>{thisVersion?.nombre ?? "Base"}</p>
                <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: BRAND.ink }}>{formatCOP(resp.totales.base)}<span className="text-xs font-normal ml-1" style={{ color: BRAND.inkMuted }}>/Ton</span></p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>{compareVersion?.nombre ?? "Comparada"}</p>
                <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: BRAND.ink }}>{formatCOP(resp.totales.comp)}<span className="text-xs font-normal ml-1" style={{ color: BRAND.inkMuted }}>/Ton</span></p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>Variación</p>
                <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: delta >= 0 ? BRAND.danger : BRAND.success }}>
                  {delta >= 0 ? "+" : ""}{formatCOP(delta)}
                </p>
                <p className="text-xs tabular-nums" style={{ color: delta >= 0 ? BRAND.danger : BRAND.success }}>
                  ({delta >= 0 ? "+" : ""}{deltaPct.toFixed(1)} %)
                </p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: BRAND.bgBand }}>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Componente</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>{thisVersion?.nombre ?? "Base"}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>{compareVersion?.nombre ?? "Comparada"}</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Δ Aporte</th>
                </tr>
              </thead>
              <tbody>
                {resp.items.slice(0, 14).map((it, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: BRAND.border }}>
                    <td className="px-4 py-2.5" style={{ color: BRAND.ink }}>{it.label}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>{formatCOP(it.baseValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>{formatCOP(it.compValue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: it.delta >= 0 ? BRAND.danger : it.delta < 0 ? BRAND.success : BRAND.inkMuted }}>
                      {it.delta === 0 ? "—" : `${it.delta >= 0 ? "+" : ""}${formatCOP(it.delta)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: BRAND.primarySoft, borderTop: `2px solid ${BRAND.primary}` }}>
                  <td className="px-4 py-3 font-bold uppercase tracking-wide text-xs" style={{ color: BRAND.ink }}>Total</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: BRAND.ink }}>{formatCOP(resp.totales.base)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: BRAND.ink }}>{formatCOP(resp.totales.comp)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: delta >= 0 ? BRAND.danger : BRAND.success }}>
                    {delta >= 0 ? "+" : ""}{formatCOP(delta)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}
