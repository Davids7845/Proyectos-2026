// Cuadro detallado por proceso — réplica de la hoja "Costo" del Excel para un ORD.
// Hero card + tabla de aporte con barras + donut de composición.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import DonutChart from "@/components/charts/DonutChart";
import { BRAND, formatCOP, formatMes } from "@/lib/ui/colors";

interface PageProps {
  params: Promise<{ id: string; ord: string }>;
  searchParams: Promise<{ periodo?: string }>;
}

interface ComponenteRow {
  concepto: string;
  consumo: number | null;
  consumo_unidad: string;
  precio_unit: number | null;
  costo_por_ton: number;
  calc_id: string | null;
  tipo: string;
}

export default async function ProcesoDetallePage({ params, searchParams }: PageProps) {
  const { id, ord: ordStr } = await params;
  const sp = await searchParams;
  const ordNum = Number(ordStr);
  if (isNaN(ordNum)) notFound();

  const supabase = await createClient();

  const [
    { data: version },
    { data: proceso },
  ] = await Promise.all([
    supabase.from("budget_versions").select("id, nombre").eq("id", id).single(),
    supabase.from("procesos").select("id, ord, nombre").eq("ord", ordNum).maybeSingle(),
  ]);
  if (!version || !proceso) notFound();

  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id, estado, iniciado_en")
    .eq("version_id", id)
    .in("estado", ["exitoso"])
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: costoProcPeriodos } = await supabase
    .from("costo_proceso")
    .select("periodo, costo_por_ton, costo_total")
    .eq("run_id", lastRun?.id ?? "")
    .eq("proceso_id", proceso.id)
    .order("periodo");

  const periodos = (costoProcPeriodos ?? []).map(r => r.periodo as string);
  const selectedPeriodo = sp.periodo ?? periodos[periodos.length - 1] ?? null;

  const { data: rendimiento } = await supabase
    .from("rendimientos")
    .select("produccion_ton")
    .eq("version_id", id)
    .eq("proceso_id", proceso.id)
    .eq("periodo", selectedPeriodo ?? "")
    .maybeSingle();
  const produccionTon = Number(rendimiento?.produccion_ton ?? 0);

  const { data: logRows } = selectedPeriodo && lastRun ? await supabase
    .from("calculation_log")
    .select("id, calculo_tipo, material_id, concepto, valor_resultado, parametros_entrada, unidad")
    .eq("run_id", lastRun.id)
    .eq("proceso_id", proceso.id)
    .eq("periodo", selectedPeriodo)
    .order("nivel_jerarquia", { ascending: false })
    : { data: [] };

  const { data: recetaRaw } = selectedPeriodo ? await supabase
    .from("recetas")
    .select("receta_lineas(material_id, porcentaje)")
    .eq("version_id", id)
    .eq("proceso_id", proceso.id)
    .eq("periodo", selectedPeriodo)
    .maybeSingle()
    : { data: null };
  const pctByMat = new Map<string, number>();
  for (const ln of (recetaRaw as any)?.receta_lineas ?? []) {
    pctByMat.set(ln.material_id, Number(ln.porcentaje));
  }

  // Une material_ids de logs + de la receta para que las filas custom de ORD 1/2
  // (que descomponen el MP desde parametros_entrada) puedan resolver nombres.
  const matIdsSet = new Set<string>();
  for (const r of logRows ?? []) if (r.material_id) matIdsSet.add(r.material_id);
  for (const ln of (recetaRaw as any)?.receta_lineas ?? []) matIdsSet.add(ln.material_id);
  const matIds = Array.from(matIdsSet);
  const { data: materialesRaw } = matIds.length > 0
    ? await supabase.from("materiales").select("id, nombre, codigo").in("id", matIds)
    : { data: [] };
  const matById = new Map<string, { nombre: string; codigo: string }>();
  for (const m of materialesRaw ?? []) matById.set(m.id, { nombre: m.nombre, codigo: m.codigo });

  const componentes: ComponenteRow[] = [];
  let total_costo_ton = 0;

  // Cache de materiales por código para resolver nombres en componentes derivados
  // de ORD 1 y ORD 2 (que no se loguean como precio_componente_* sino dentro de
  // parametros_entrada del log de MP).
  const matByCodigo = new Map<string, { nombre: string }>();
  for (const m of materialesRaw ?? []) matByCodigo.set(m.codigo, { nombre: m.nombre });

  for (const row of logRows ?? []) {
    const tipo = row.calculo_tipo as string;
    const params = row.parametros_entrada as Record<string, unknown>;

    if (tipo === "precio_componente_directo" || tipo === "precio_componente_derivado") {
      if (!row.material_id) continue;
      const mat = matById.get(row.material_id);
      const pct = pctByMat.get(row.material_id) ?? null;
      const aporte = pct != null ? row.valor_resultado * pct : 0;
      componentes.push({
        concepto: mat?.nombre ?? row.material_id,
        consumo: pct,
        consumo_unidad: "Ton/Ton",
        precio_unit: row.valor_resultado,
        costo_por_ton: aporte,
        calc_id: row.id,
        tipo: "mp",
      });
      if (pct != null) total_costo_ton += aporte;
    } else if (tipo === "costo_energia_proceso") {
      const kwh = Number(params.kwh_ton ?? 0);
      const precioEfec = kwh > 0 ? row.valor_resultado / kwh : null;
      componentes.push({
        concepto: "Energía Eléctrica",
        consumo: kwh || null,
        consumo_unidad: "kWh/Ton",
        precio_unit: precioEfec,
        costo_por_ton: row.valor_resultado,
        calc_id: row.id,
        tipo: "energia",
      });
      total_costo_ton += row.valor_resultado;
    } else if (tipo === "costo_componente_derivado_termico") {
      const mat = row.material_id ? matById.get(row.material_id) : null;
      const consumo = Number(params.consumo ?? 0);
      const precioArr = Number(params.precio_arrastrado ?? 0);
      componentes.push({
        concepto: mat?.nombre ?? row.concepto ?? "Combustible",
        consumo: consumo || null,
        consumo_unidad: "Ton/Ton",
        precio_unit: precioArr || null,
        costo_por_ton: row.valor_resultado,
        calc_id: row.id,
        tipo: "combustible",
      });
      total_costo_ton += row.valor_resultado;
    } else if (tipo === "costo_fijo_proceso") {
      if (row.valor_resultado === 0) continue;
      componentes.push({
        concepto: String(params.nombre ?? params.codigo ?? row.concepto ?? "Costo fijo"),
        consumo: 1,
        consumo_unidad: "Ton/Ton",
        precio_unit: row.valor_resultado,
        costo_por_ton: row.valor_resultado,
        calc_id: row.id,
        tipo: "fijo",
      });
      total_costo_ton += row.valor_resultado;
    } else if (tipo === "costo_mp_prehomo") {
      // ORD 1: el MP se loguea como un sólo agregado; descomponemos en
      // caliza (precio ponderado caliza+martillo) y arcilla.
      const precioCaliza = Number(params.precio_caliza_martillo ?? 0);
      const precioArcilla = Number(params.precio_arcilla ?? 0);
      const pctCaliza = Number(params.pct_caliza ?? 0);
      const pctArcilla = Number(params.pct_arcilla ?? 0);
      const nombreCaliza = matByCodigo.get("CALTLVTRIT")?.nombre ?? "Caliza";
      const nombreArcilla = matByCodigo.get("ARCTLVTRIT")?.nombre ?? "Arcilla";
      const aporteCaliza = pctCaliza * precioCaliza;
      const aporteArcilla = pctArcilla * precioArcilla;
      if (aporteCaliza > 0) {
        componentes.push({
          concepto: nombreCaliza,
          consumo: pctCaliza,
          consumo_unidad: "Ton/Ton",
          precio_unit: precioCaliza,
          costo_por_ton: aporteCaliza,
          calc_id: row.id,
          tipo: "mp",
        });
        total_costo_ton += aporteCaliza;
      }
      if (aporteArcilla > 0) {
        componentes.push({
          concepto: nombreArcilla,
          consumo: pctArcilla,
          consumo_unidad: "Ton/Ton",
          precio_unit: precioArcilla,
          costo_por_ton: aporteArcilla,
          calc_id: row.id,
          tipo: "mp",
        });
        total_costo_ton += aporteArcilla;
      }
    } else if (tipo === "costo_mp_adiciones") {
      // ORD 2: el MP se loguea con items_json (lista de {nombre, precio, pct}).
      const items = Array.isArray(params.items) ? params.items as Array<{ nombre?: string; precio?: number; pct?: number }> : [];
      for (const it of items) {
        const pct = Number(it.pct ?? 0);
        const precio = Number(it.precio ?? 0);
        const aporte = pct * precio;
        if (aporte <= 0) continue;
        componentes.push({
          concepto: String(it.nombre ?? "Componente"),
          consumo: pct,
          consumo_unidad: "Ton/Ton",
          precio_unit: precio,
          costo_por_ton: aporte,
          calc_id: row.id,
          tipo: "mp",
        });
        total_costo_ton += aporte;
      }
    } else if (tipo === "costo_referencia_cemento") {
      // ORD 21 (Cementos): consolidador con promedio simple. Cada referencia
      // aporta su costo / N para que la suma del desglose iguale el promedio.
      componentes.push({
        concepto: row.concepto ?? "Referencia",
        consumo: 1,
        consumo_unidad: "Ton/Ton",
        precio_unit: row.valor_resultado,
        costo_por_ton: row.valor_resultado, // se reescala abajo
        calc_id: row.id,
        tipo: "referencia",
      });
    }
  }

  // ORD 21: reescalar referencias para que sumen el promedio.
  const refs = componentes.filter(c => c.tipo === "referencia");
  if (refs.length > 0) {
    for (const r of refs) {
      r.costo_por_ton = r.costo_por_ton / refs.length;
      r.consumo = 1 / refs.length;
    }
    total_costo_ton += refs.reduce((s, r) => s + r.costo_por_ton, 0);
  }

  // Filtrar componentes con aporte > 0 para el donut
  const donutData = componentes
    .filter(c => c.costo_por_ton > 0)
    .map(c => ({ name: c.concepto, value: c.costo_por_ton }));

  const costo_total_cop = total_costo_ton * produccionTon;
  const costoRow = (costoProcPeriodos ?? []).find(r => r.periodo === selectedPeriodo);

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <nav className="text-xs flex items-center gap-1" style={{ color: BRAND.inkSecondary }}>
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span>/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span>/</span>
        <Link href={`/versiones/${id}/costo`} className="hover:underline flex items-center gap-1">
          <ChevronLeft size={12} /> Costo
        </Link>
        <span>/</span>
        <span style={{ color: BRAND.ink }} className="font-medium">Proceso {ordNum}</span>
      </nav>

      {/* ── Hero card ── */}
      <div
        className="bg-white rounded-xl shadow-sm p-6"
        style={{ borderTop: `4px solid ${BRAND.primary}`, border: `1px solid ${BRAND.border}` }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>
              Proceso N° {String(ordNum).padStart(2, "0")}
            </p>
            <h1 className="text-2xl font-bold mt-1" style={{ color: BRAND.ink }}>{proceso.nombre}</h1>
          </div>
          {periodos.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 max-w-md justify-end">
              {periodos.map(p => (
                <Link
                  key={p}
                  href={`/versiones/${id}/costo/proceso/${ordNum}?periodo=${p}`}
                  className="px-2.5 py-1 rounded text-xs font-medium border transition-colors"
                  style={
                    p === selectedPeriodo
                      ? { backgroundColor: BRAND.primary, color: "white", borderColor: BRAND.primary }
                      : { borderColor: BRAND.border, color: BRAND.inkSecondary }
                  }
                >
                  {formatMes(p)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6 pt-6 border-t" style={{ borderColor: BRAND.border }}>
          <div>
            <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>
              Costo unitario
            </p>
            <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: BRAND.ink }}>
              {costoRow ? formatCOP(Number(costoRow.costo_por_ton)) : "—"}
              <span className="text-sm font-normal ml-1" style={{ color: BRAND.inkMuted }}>/Ton</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>
              Producción
            </p>
            <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: BRAND.ink }}>
              {produccionTon > 0 ? produccionTon.toLocaleString("es-CO", { maximumFractionDigits: 0 }) : "—"}
              <span className="text-sm font-normal ml-1" style={{ color: BRAND.inkMuted }}>Ton</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-medium" style={{ color: BRAND.inkMuted }}>
              Costo total del periodo
            </p>
            <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: BRAND.ink }}>
              {produccionTon > 0 ? formatCOP(costo_total_cop) : "—"}
            </p>
          </div>
        </div>
      </div>

      {!lastRun ? (
        <EmptyCard id={id} mensaje="No hay cálculos para esta versión." />
      ) : componentes.length === 0 ? (
        <EmptyCard id={id} mensaje="No hay componentes calculados para este proceso en el período seleccionado." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Tabla de desglose con barras ── */}
          <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm overflow-hidden" style={{ borderColor: BRAND.border }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: BRAND.border }}>
              <h2 className="text-base font-semibold" style={{ color: BRAND.ink }}>Desglose del costo</h2>
              <p className="text-xs mt-0.5" style={{ color: BRAND.inkMuted }}>
                {selectedPeriodo ? formatMes(selectedPeriodo) : "—"} · click componente → trazabilidad
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: BRAND.bgBand }}>
                  <th className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Componente</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Consumo/Ton</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Precio Unit</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Aporte COP/Ton</th>
                </tr>
              </thead>
              <tbody>
                {componentes.map((c, i) => {
                  const pct = total_costo_ton > 0 ? (c.costo_por_ton / total_costo_ton) * 100 : 0;
                  const color = BRAND.chart[i % BRAND.chart.length];
                  return (
                    <tr key={i} className="border-b" style={{ borderColor: BRAND.border }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {c.calc_id ? (
                            <Link
                              href={`/versiones/${id}/calculos/${c.calc_id}`}
                              className="hover:underline"
                              style={{ color: BRAND.ink }}
                            >
                              {c.concepto}
                            </Link>
                          ) : (
                            <span style={{ color: BRAND.ink }}>{c.concepto}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ color: BRAND.inkSecondary }}>
                        {c.consumo != null ? c.consumo.toLocaleString("es-CO", { maximumFractionDigits: 4 }) : "—"}
                        <span className="text-xs ml-1" style={{ color: BRAND.inkMuted }}>{c.consumo_unidad === "Ton/Ton" ? "" : c.consumo_unidad}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>
                        {c.precio_unit != null ? formatCOP(c.precio_unit) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="font-semibold tabular-nums" style={{ color: BRAND.ink }}>
                          {formatCOP(c.costo_por_ton)}
                        </div>
                        <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: BRAND.bgBand }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
                          />
                        </div>
                        <div className="text-xs mt-0.5 tabular-nums" style={{ color: BRAND.inkMuted }}>
                          {pct.toFixed(1)} %
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: BRAND.primarySoft, borderTop: `2px solid ${BRAND.primary}` }}>
                  <td className="px-4 py-3 font-bold uppercase tracking-wide text-xs" colSpan={3} style={{ color: BRAND.ink }}>
                    Total {proceso.nombre}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-base" style={{ color: BRAND.ink }}>
                    {formatCOP(total_costo_ton)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Donut composición ── */}
          <div className="bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border }}>
            <h2 className="text-base font-semibold mb-1" style={{ color: BRAND.ink }}>Composición</h2>
            <p className="text-xs mb-4" style={{ color: BRAND.inkMuted }}>
              % aporte por componente
            </p>
            {donutData.length > 0 ? (
              <>
                <DonutChart data={donutData} height={240} unit="COP" />
                <ul className="mt-4 space-y-1.5 text-xs">
                  {donutData.map((d, i) => {
                    const pct = total_costo_ton > 0 ? (d.value / total_costo_ton) * 100 : 0;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 truncate">
                          <span
                            aria-hidden
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: BRAND.chart[i % BRAND.chart.length] }}
                          />
                          <span className="truncate" style={{ color: BRAND.inkSecondary }}>{d.name}</span>
                        </span>
                        <span className="tabular-nums font-medium" style={{ color: BRAND.ink }}>
                          {pct.toFixed(1)} %
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm" style={{ color: BRAND.inkMuted }}>Sin datos de composición.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyCard({ id, mensaje }: { id: string; mensaje: string }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-12 text-center" style={{ borderColor: BRAND.border }}>
      <p className="text-sm" style={{ color: BRAND.inkSecondary }}>{mensaje}</p>
      <Link
        href={`/versiones/${id}/calcular`}
        className="inline-block mt-3 text-sm hover:underline"
        style={{ color: BRAND.primary }}
      >
        Ir a calcular →
      </Link>
    </div>
  );
}
