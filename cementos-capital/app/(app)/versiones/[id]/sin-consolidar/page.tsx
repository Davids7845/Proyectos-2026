import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock, Info } from "lucide-react";
import { BRAND, formatCOP, formatMes } from "@/lib/ui/colors";

interface CostoCell {
  costo_por_ton: number;
  proceso_id: string;
}

// Procesos considerados "consolidables" — son los que cambian al activar precios_fijos
const PROCESOS_CONSOLIDABLES_ORDS = [1, 2]; // Trituración, Adiciones / Prehomo

export default async function SinConsolidarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado, precios_fijos")
    .eq("id", id)
    .single();
  if (!version) notFound();

  const preciosFijos = Boolean(version.precios_fijos);

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-xs flex items-center gap-1 mb-3" style={{ color: BRAND.inkSecondary }}>
          <Link href="/versiones" className="hover:underline">Versiones</Link>
          <span>/</span>
          <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: BRAND.ink }}>Sin Consolidar</span>
        </nav>
        <header className="pb-4 border-b" style={{ borderColor: BRAND.border }}>
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Costo sin consolidar</h1>
          <p className="text-sm mt-1" style={{ color: BRAND.inkSecondary }}>
            Comparativa entre el modo consolidado (cascada normal) y el modo sin consolidar (precios fijos para procesos productores intermedios)
          </p>
        </header>
      </div>

      {/* Info banner */}
      <div
        className="rounded-xl border p-5 flex gap-3"
        style={{
          borderColor: preciosFijos ? BRAND.primary : BRAND.warning,
          backgroundColor: preciosFijos ? BRAND.primarySoft : BRAND.warningSoft,
        }}
      >
        <Info size={20} className="flex-shrink-0 mt-0.5" style={{ color: preciosFijos ? BRAND.primary : BRAND.warning }} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold mb-1" style={{ color: BRAND.ink }}>
            Modo: {preciosFijos ? "Sin Consolidar (precios fijos activos)" : "Consolidado (cascada normal)"}
          </h2>
          {preciosFijos ? (
            <p className="text-sm" style={{ color: BRAND.inkSecondary }}>
              Esta versión usa <strong>precios fijos</strong> para Trituración y Adiciones en lugar de cascadear desde sus
              procesos productores. La tabla de abajo compara el costo con/sin esta configuración.
            </p>
          ) : (
            <>
              <p className="text-sm" style={{ color: BRAND.inkSecondary }}>
                Esta versión usa el modo <strong>consolidado</strong> (cascada normal). Para ver el costo sin consolidar:
              </p>
              <ol className="text-sm mt-2 ml-4 list-decimal space-y-1" style={{ color: BRAND.inkSecondary }}>
                <li>Ve a <Link href={`/versiones/${id}/datos/precios-fijos`} className="underline" style={{ color: BRAND.primary }}>Precios Fijos</Link></li>
                <li>Marca la casilla &quot;precios_fijos&quot; en la versión</li>
                <li>Carga los precios fijos por proceso · periodo</li>
                <li>Recalcula y regresa aquí</li>
              </ol>
            </>
          )}
        </div>
      </div>

      {preciosFijos && <ConsolidacionCompare versionId={id} />}
    </div>
  );
}

async function ConsolidacionCompare({ versionId }: { versionId: string }) {
  const supabase = await createClient();

  // Último run para esta versión
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id")
    .eq("version_id", versionId)
    .eq("estado", "exitoso")
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastRun) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-12 text-center" style={{ borderColor: BRAND.border }}>
        <p className="text-sm" style={{ color: BRAND.inkSecondary }}>
          Aún no hay cálculo para esta versión.
        </p>
        <Link
          href={`/versiones/${versionId}/calcular`}
          className="inline-block mt-3 text-sm hover:underline"
          style={{ color: BRAND.primary }}
        >
          Ir a calcular →
        </Link>
      </div>
    );
  }

  const { data: costoRows } = await supabase
    .from("costo_proceso")
    .select("periodo, costo_por_ton, proceso:procesos(id, nombre, ord, orden_topologico)")
    .eq("run_id", lastRun.id);

  // Cargar precios_fijos_overrides para identificar procesos forzados
  const { data: pfRows } = await (supabase as any)
    .from("precios_fijos_overrides")
    .select("proceso_id, periodo, precio_cop_ton")
    .eq("version_id", versionId);

  const fixedKeys = new Set<string>();
  for (const pf of (pfRows ?? []) as Array<{ proceso_id: string; periodo: string }>) {
    fixedKeys.add(`${pf.proceso_id}|${pf.periodo}`);
  }

  interface ProcRow {
    proceso_id: string;
    ord: number;
    orden_topologico: number;
    nombre: string;
    byPeriodo: Map<string, CostoCell>;
  }
  const procesos = new Map<string, ProcRow>();
  const periodosSet = new Set<string>();

  for (const r of (costoRows ?? []) as any[]) {
    if (!r.proceso) continue;
    periodosSet.add(r.periodo);
    const key = r.proceso.id;
    if (!procesos.has(key)) {
      procesos.set(key, {
        proceso_id: r.proceso.id,
        ord: r.proceso.ord,
        orden_topologico: r.proceso.orden_topologico,
        nombre: r.proceso.nombre,
        byPeriodo: new Map(),
      });
    }
    procesos.get(key)!.byPeriodo.set(r.periodo, {
      costo_por_ton: Number(r.costo_por_ton),
      proceso_id: r.proceso.id,
    });
  }

  const filas = Array.from(procesos.values()).sort((a, b) => a.orden_topologico - b.orden_topologico);
  const periodos = Array.from(periodosSet).sort();

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden" style={{ borderColor: BRAND.border }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: BRAND.border }}>
        <h2 className="text-base font-semibold" style={{ color: BRAND.ink }}>Matriz costo/Ton — procesos con candado tienen precio fijo</h2>
        <p className="text-xs mt-0.5" style={{ color: BRAND.inkMuted }}>
          Los procesos marcados con <Lock size={11} className="inline" /> usan precio fijo en lugar de cascada
        </p>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: BRAND.bgBand }}>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide sticky left-0 z-10" style={{ color: BRAND.inkSecondary, backgroundColor: BRAND.bgBand }}>Proceso</th>
              {periodos.map(per => (
                <th key={per} className="px-3 py-3 text-right font-semibold text-xs uppercase tracking-wide tabular-nums" style={{ color: BRAND.inkSecondary }}>
                  {formatMes(per)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, idx) => {
              const isConsolidable = PROCESOS_CONSOLIDABLES_ORDS.includes(f.ord);
              return (
                <tr key={f.proceso_id} className="border-b" style={{ borderColor: BRAND.border, backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard }}>
                  <td className="px-4 py-2.5 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 1 ? BRAND.bgBand : BRAND.bgCard, color: BRAND.ink }}>
                    <span className="text-xs tabular-nums mr-2" style={{ color: BRAND.inkMuted }}>{String(f.ord).padStart(2, "0")}</span>
                    {f.nombre}
                    {isConsolidable && (
                      <Lock size={12} className="inline ml-2" style={{ color: BRAND.primary }} />
                    )}
                  </td>
                  {periodos.map(per => {
                    const cell = f.byPeriodo.get(per);
                    const isFixed = fixedKeys.has(`${f.proceso_id}|${per}`);
                    if (!cell) {
                      return <td key={per} className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkMuted }}>—</td>;
                    }
                    return (
                      <td key={per} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: BRAND.inkSecondary }}>
                        {formatCOP(cell.costo_por_ton)}
                        {isFixed && <Lock size={10} className="inline ml-1" style={{ color: BRAND.primary }} />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
