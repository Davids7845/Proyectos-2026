"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BRAND, formatCOP, formatMes, formatPct } from "@/lib/ui/colors";

interface ComponenteOut {
  tipo: string;
  codigo: string;
  nombre: string;
  consumo: number;
  costo_unitario: number;
  aporte: number;
}
interface ProcesoOut {
  proceso_id: string;
  ord: number;
  nombre: string;
  meses: number;
  produccion: number;
  costo_por_ton: number;
  componentes: ComponenteOut[];
}
interface PonderadoResp {
  periodos_disponibles: string[];
  procesos: ProcesoOut[];
}

type Modo = "anual" | "mes" | "rango";

const TIPO_LABEL: Record<string, string> = { mp: "Materia Prima", energia: "Energía", fijo: "Costo Fijo" };
const TIPO_COLOR: Record<string, string> = { mp: BRAND.primary, energia: BRAND.accent, fijo: BRAND.tealDark };

export default function PonderadoPage() {
  const { id } = useParams() as { id: string };

  const [versionNombre, setVersionNombre] = useState<string>("…");
  const [modo, setModo] = useState<Modo>("anual");
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [mesUnico, setMesUnico] = useState<string>("");
  const [rangoIni, setRangoIni] = useState<string>("");
  const [rangoFin, setRangoFin] = useState<string>("");
  const [data, setData] = useState<PonderadoResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sb = createClient();
    sb.from("budget_versions").select("nombre").eq("id", id).single()
      .then(({ data: v }) => setVersionNombre((v as { nombre?: string } | null)?.nombre ?? "Versión"));
  }, [id]);

  const fetchData = useCallback(async (desde: string | null, hasta: string | null) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    const r = await fetch(`/api/versiones/${id}/ponderado?${qs.toString()}`);
    const j = (await r.json()) as PonderadoResp;
    setData(j);
    if (periodos.length === 0 && j.periodos_disponibles?.length) {
      setPeriodos(j.periodos_disponibles);
      setMesUnico(j.periodos_disponibles[j.periodos_disponibles.length - 1]);
      setRangoIni(j.periodos_disponibles[0]);
      setRangoFin(j.periodos_disponibles[j.periodos_disponibles.length - 1]);
    }
    setLoading(false);
  }, [id, periodos.length]);

  // Carga inicial: promedio anual (sin filtro).
  useEffect(() => { fetchData(null, null); }, [fetchData]);

  function aplicar() {
    if (modo === "anual") fetchData(null, null);
    else if (modo === "mes") fetchData(mesUnico, mesUnico);
    else fetchData(rangoIni, rangoFin);
  }

  function toggle(pid: string) {
    setExpandido(prev => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid); else n.add(pid);
      return n;
    });
  }

  const etiquetaFiltro =
    modo === "anual" ? `Promedio de ${periodos.length || "todos los"} meses`
    : modo === "mes" ? `Mes: ${mesUnico ? formatMes(mesUnico) : "—"}`
    : `Rango: ${rangoIni ? formatMes(rangoIni) : "—"} → ${rangoFin ? formatMes(rangoFin) : "—"}`;

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-xs flex items-center gap-1 mb-3" style={{ color: BRAND.inkSecondary }}>
          <Link href="/versiones" className="hover:underline">Versiones</Link>
          <span>/</span>
          <Link href={`/versiones/${id}`} className="hover:underline">{versionNombre}</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: BRAND.ink }}>Costo Ponderado</span>
        </nav>
        <header className="pb-4 border-b" style={{ borderColor: BRAND.border }}>
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Costo ponderado por proceso</h1>
          <p className="text-sm mt-1" style={{ color: BRAND.inkSecondary }}>
            Promedio ponderado <code>SUMA(valor) / SUMA(producción)</code> sobre los meses del filtro.
          </p>
        </header>
      </div>

      {/* Filtro de período */}
      <div className="bg-white border rounded-xl shadow-sm p-4" style={{ borderColor: BRAND.border }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs uppercase tracking-wide font-medium block mb-1.5" style={{ color: BRAND.inkMuted }}>Período</label>
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: BRAND.border }}>
              {([["anual", "Todo el año"], ["mes", "Un mes"], ["rango", "Rango"]] as Array<[Modo, string]>).map(([m, lbl]) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className="px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: modo === m ? BRAND.primary : "white",
                    color: modo === m ? "white" : BRAND.inkSecondary,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {modo === "mes" && (
            <div>
              <label className="text-xs uppercase tracking-wide font-medium block mb-1.5" style={{ color: BRAND.inkMuted }}>Mes</label>
              <select value={mesUnico} onChange={e => setMesUnico(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg border bg-white" style={{ borderColor: BRAND.border, color: BRAND.ink }}>
                {periodos.map(p => <option key={p} value={p}>{formatMes(p)}</option>)}
              </select>
            </div>
          )}

          {modo === "rango" && (
            <>
              <div>
                <label className="text-xs uppercase tracking-wide font-medium block mb-1.5" style={{ color: BRAND.inkMuted }}>Desde</label>
                <select value={rangoIni} onChange={e => setRangoIni(e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg border bg-white" style={{ borderColor: BRAND.border, color: BRAND.ink }}>
                  {periodos.map(p => <option key={p} value={p}>{formatMes(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide font-medium block mb-1.5" style={{ color: BRAND.inkMuted }}>Hasta</label>
                <select value={rangoFin} onChange={e => setRangoFin(e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg border bg-white" style={{ borderColor: BRAND.border, color: BRAND.ink }}>
                  {periodos.map(p => <option key={p} value={p}>{formatMes(p)}</option>)}
                </select>
              </div>
            </>
          )}

          <button onClick={aplicar} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}>
            {loading ? "Calculando…" : "Aplicar"}
          </button>

          <span className="text-xs ml-auto" style={{ color: BRAND.inkMuted }}>{etiquetaFiltro}</span>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: BRAND.primary }} />
        </div>
      )}

      {data && data.procesos.length === 0 && (
        <div className="bg-white border rounded-xl shadow-sm p-12 text-center" style={{ borderColor: BRAND.border }}>
          <p className="text-sm" style={{ color: BRAND.inkSecondary }}>
            No hay movimientos para el filtro seleccionado. Ejecuta un cálculo para generar la capa de agregación.
          </p>
        </div>
      )}

      {data && data.procesos.map(p => {
        const abierto = expandido.has(p.proceso_id);
        return (
          <div key={p.proceso_id} className="bg-white border rounded-xl shadow-sm overflow-hidden"
            style={{ borderColor: BRAND.border, borderTop: `4px solid ${BRAND.primary}` }}>
            <button onClick={() => toggle(p.proceso_id)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: BRAND.bgBand, color: BRAND.inkMuted }}>
                  ORD {String(p.ord).padStart(2, "0")}
                </span>
                <span className="text-base font-bold" style={{ color: BRAND.ink }}>{p.nombre}</span>
                <span className="text-xs" style={{ color: BRAND.inkMuted }}>{p.meses} {p.meses === 1 ? "mes" : "meses"}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xl font-bold tabular-nums" style={{ color: BRAND.ink }}>
                    {formatCOP(p.costo_por_ton)}<span className="text-xs font-normal ml-1" style={{ color: BRAND.inkMuted }}>/Ton</span>
                  </p>
                </div>
                <span className="text-lg" style={{ color: BRAND.inkMuted }}>{abierto ? "▾" : "▸"}</span>
              </div>
            </button>

            {abierto && (
              <table className="w-full text-sm border-t" style={{ borderColor: BRAND.border }}>
                <thead>
                  <tr style={{ backgroundColor: BRAND.bgBand }}>
                    <th className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Componente</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Tipo</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Consumo</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Costo unit.</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Aporte /Ton</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.componentes.map((c, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: BRAND.border }}>
                      <td className="px-4 py-2.5" style={{ color: BRAND.ink }}>{c.nombre}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TIPO_COLOR[c.tipo]}1a`, color: TIPO_COLOR[c.tipo] }}>
                          {TIPO_LABEL[c.tipo] ?? c.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>{c.consumo.toLocaleString("es-CO", { maximumFractionDigits: 4 })}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>{formatCOP(c.costo_unitario)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: BRAND.ink }}>{formatCOP(c.aporte)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkMuted }}>
                        {p.costo_por_ton > 0 ? formatPct((c.aporte / p.costo_por_ton) * 100) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: BRAND.primarySoft, borderTop: `2px solid ${BRAND.primary}` }}>
                    <td className="px-4 py-3 font-bold uppercase tracking-wide text-xs" style={{ color: BRAND.ink }} colSpan={4}>Total ponderado</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: BRAND.ink }}>{formatCOP(p.costo_por_ton)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: BRAND.ink }}>100 %</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
