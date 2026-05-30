// Comparación temporal (R6a): motor viejo (costo_proceso) vs motor nuevo
// (costo_calculado) lado a lado para el período 1. Vista de verificación que
// se elimina en R6c. NO destructiva.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BRAND, formatCOP } from "@/lib/ui/colors";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompararMotoresPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, fecha_inicio")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // ── Motor VIEJO: último run exitoso → costo_proceso (primer período) ──
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", id)
    .eq("estado", "exitoso")
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const viejoPorOrd = new Map<number, number>();
  let periodoViejo: string | null = null;
  if (lastRun) {
    const { data: costoRows } = await supabase
      .from("costo_proceso")
      .select("periodo, costo_por_ton, proceso:procesos(ord)")
      .eq("run_id", lastRun.id)
      .order("periodo");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (costoRows ?? []) as any[];
    // primer período disponible
    const periodos = Array.from(new Set(rows.map(r => r.periodo as string))).sort();
    periodoViejo = periodos[0] ?? null;
    for (const r of rows) {
      if (r.periodo !== periodoViejo || !r.proceso) continue;
      viejoPorOrd.set(Number(r.proceso.ord), Number(r.costo_por_ton));
    }
  }

  // ── Motor NUEVO: costo_calculado es_total para período 1 ──
  // (tabla del motor nuevo aún no presente en los tipos generados → cast a any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nuevoRows } = await (supabase as any)
    .from("costo_calculado")
    .select("ord, aporte_por_ton")
    .eq("version_id", id)
    .eq("periodo", 1)
    .eq("es_total", true)
    .order("ord");
  const nuevoPorOrd = new Map<number, number>();
  for (const r of (nuevoRows ?? []) as Array<{ ord: number; aporte_por_ton: number }>) {
    nuevoPorOrd.set(Number(r.ord), Number(r.aporte_por_ton));
  }

  // ── Nombres de proceso ──
  const ordsSet = Array.from(
    new Set([...Array.from(viejoPorOrd.keys()), ...Array.from(nuevoPorOrd.keys())])
  ).sort((a, b) => a - b);
  const { data: procRows } = ordsSet.length > 0
    ? await supabase.from("procesos").select("ord, nombre, orden_topologico").in("ord", ordsSet)
    : { data: [] };
  const nombrePorOrd = new Map<number, { nombre: string; orden: number }>();
  for (const p of (procRows ?? []) as Array<{ ord: number; nombre: string; orden_topologico: number | null }>) {
    nombrePorOrd.set(p.ord, { nombre: p.nombre, orden: p.orden_topologico ?? p.ord });
  }

  const filas = ordsSet
    .map(ord => {
      const viejo = viejoPorOrd.get(ord) ?? null;
      const nuevo = nuevoPorOrd.get(ord) ?? null;
      const diff = viejo != null && nuevo != null && viejo !== 0
        ? (nuevo - viejo) / viejo
        : null;
      return {
        ord,
        nombre: nombrePorOrd.get(ord)?.nombre ?? `ORD ${ord}`,
        orden: nombrePorOrd.get(ord)?.orden ?? ord,
        viejo, nuevo, diff,
      };
    })
    .sort((a, b) => a.orden - b.orden);

  const sinNuevo = nuevoPorOrd.size === 0;

  return (
    <div className="space-y-6">
      <nav className="text-xs flex items-center gap-1" style={{ color: BRAND.inkSecondary }}>
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span>/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span>/</span>
        <Link href={`/versiones/${id}/costo`} className="hover:underline flex items-center gap-1">
          <ChevronLeft size={12} /> Costo
        </Link>
        <span>/</span>
        <span style={{ color: BRAND.ink }} className="font-medium">Comparar motores</span>
      </nav>

      <header className="pb-4 border-b" style={{ borderColor: BRAND.border }}>
        <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Comparación de motores</h1>
        <p className="text-sm mt-1" style={{ color: BRAND.inkMuted }}>
          Motor viejo (<code>costo_proceso</code>) vs motor nuevo (<code>costo_calculado</code>) — primer período.
          Vista temporal R6a, no destructiva.
        </p>
      </header>

      {sinNuevo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
          El motor nuevo aún no tiene datos. Ve a <Link href={`/versiones/${id}/costo`} className="underline">Costo</Link> y
          pulsa <strong>“Recalcular motor nuevo”</strong> primero.
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden" style={{ borderColor: BRAND.border }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND.bgBand }} className="border-b" >
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Proceso</th>
              <th className="px-3 py-3 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Motor viejo</th>
              <th className="px-3 py-3 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Motor nuevo</th>
              <th className="px-3 py-3 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, idx) => {
              const diffColor = f.diff == null ? BRAND.inkMuted
                : Math.abs(f.diff) < 0.01 ? BRAND.success
                : Math.abs(f.diff) < 0.05 ? BRAND.warning
                : BRAND.danger;
              return (
                <tr key={f.ord} className="border-b" style={{ borderColor: BRAND.border, backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}>
                  <td className="px-4 py-2.5" style={{ color: BRAND.ink }}>
                    <span className="text-xs mr-2 tabular-nums" style={{ color: BRAND.inkMuted }}>{String(f.ord).padStart(2, "0")}</span>
                    {f.nombre}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>
                    {f.viejo != null ? formatCOP(f.viejo) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: BRAND.ink }}>
                    {f.nuevo != null ? formatCOP(f.nuevo) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: diffColor }}>
                    {f.diff != null ? `${f.diff >= 0 ? "+" : ""}${(f.diff * 100).toFixed(2)} %` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
