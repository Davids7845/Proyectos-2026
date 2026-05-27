import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import EnergiaTable from "@/components/datos/EnergiaTable";
import { PreciosLineChart, ConsumoBarChart, MixDonut } from "@/components/charts/EnergiaCharts";
import { BRAND, formatCOP } from "@/lib/ui/colors";

export default async function EnergiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado")
    .eq("id", id)
    .single();
  if (!version) notFound();

  const { data: parametros } = await supabase
    .from("parametros_energia")
    .select("id, periodo, precio_contrato, precio_restricciones, cargos_fijos, kwh_ton_proceso, pci_combustibles, kcal_tck_total, pci_ponderado_horno")
    .eq("version_id", id)
    .order("periodo");

  const periodos = Array.from(new Set((parametros ?? []).map(p => p.periodo))).sort();

  const rows = (parametros ?? []).map(p => ({
    id: p.id,
    periodo: p.periodo,
    precio_contrato:      p.precio_contrato      != null ? Number(p.precio_contrato)      : null,
    precio_restricciones: p.precio_restricciones != null ? Number(p.precio_restricciones) : null,
    cargos_fijos:         p.cargos_fijos         != null ? Number(p.cargos_fijos)         : null,
    kwh_ton_proceso:      (p.kwh_ton_proceso as Record<string, number> | null) ?? null,
    pci_combustibles:     (p.pci_combustibles as Record<string, number> | null) ?? null,
    kcal_tck_total:       p.kcal_tck_total       != null ? Number(p.kcal_tck_total)       : null,
    pci_ponderado_horno:  p.pci_ponderado_horno  != null ? Number(p.pci_ponderado_horno)  : null,
  }));

  // ── KPIs ────────────────────────────────────────────────────────────
  const preciosTotales = rows
    .map(r => (r.precio_contrato ?? 0) + (r.precio_restricciones ?? 0) + (r.cargos_fijos ?? 0))
    .filter(v => v > 0);
  const precioPromedio = preciosTotales.length > 0
    ? preciosTotales.reduce((s, v) => s + v, 0) / preciosTotales.length
    : null;
  const deltaPrecio = preciosTotales.length >= 2
    ? ((preciosTotales[preciosTotales.length - 1] - preciosTotales[preciosTotales.length - 2]) / preciosTotales[preciosTotales.length - 2]) * 100
    : null;

  // kWh/Ton clinker promedio
  const clinkerKwh: number[] = [];
  for (const r of rows) {
    if (!r.kwh_ton_proceso) continue;
    for (const [proc, v] of Object.entries(r.kwh_ton_proceso)) {
      if (proc.toLowerCase().includes("clink") && typeof v === "number") clinkerKwh.push(v);
    }
  }
  const clinkerKwhProm = clinkerKwh.length > 0
    ? clinkerKwh.reduce((s, v) => s + v, 0) / clinkerKwh.length
    : null;

  const pciHornoVals = rows.map(r => r.pci_ponderado_horno).filter((v): v is number => v != null && v > 0);
  const pciHornoProm = pciHornoVals.length > 0
    ? pciHornoVals.reduce((s, v) => s + v, 0) / pciHornoVals.length
    : null;

  // ── Datos charts ─────────────────────────────────────────────────────
  const lineData = rows.map(r => ({
    periodo: r.periodo,
    contrato: r.precio_contrato,
    restricciones: r.precio_restricciones,
    cargos: r.cargos_fijos,
  }));

  // Consumo por proceso: barra horizontal con todos los periodos
  const procesosSet = new Set<string>();
  for (const r of rows) {
    if (r.kwh_ton_proceso) for (const k of Object.keys(r.kwh_ton_proceso)) procesosSet.add(k);
  }
  const procesos = Array.from(procesosSet).sort();
  const consumoData = procesos.map(proc => {
    const row: Record<string, string | number> = { proceso: proc };
    for (const r of rows) {
      const v = r.kwh_ton_proceso?.[proc];
      row[r.periodo] = typeof v === "number" ? v : 0;
    }
    return row as { proceso: string; [k: string]: string | number };
  });

  // Mix de combustibles (PCI promedio por proveedor)
  const pciByProveedor = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.pci_combustibles) continue;
    for (const [prov, v] of Object.entries(r.pci_combustibles)) {
      if (typeof v === "number" && v > 0) {
        const arr = pciByProveedor.get(prov) ?? [];
        arr.push(v);
        pciByProveedor.set(prov, arr);
      }
    }
  }
  const mixData = Array.from(pciByProveedor.entries())
    .map(([name, arr]) => ({ name, value: arr.reduce((s, v) => s + v, 0) / arr.length }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb + título ── */}
      <div>
        <nav className="text-xs flex items-center gap-1 mb-3" style={{ color: BRAND.inkSecondary }}>
          <Link href="/versiones" className="hover:underline">Versiones</Link>
          <span>/</span>
          <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
          <span>/</span>
          <span>Datos</span>
          <span>/</span>
          <span className="font-medium" style={{ color: BRAND.ink }}>Energía</span>
        </nav>
        <header className="pb-4 border-b" style={{ borderColor: BRAND.border }}>
          <h1 className="text-2xl font-bold" style={{ color: BRAND.ink }}>Parámetros de Energía</h1>
          <p className="text-sm mt-1" style={{ color: BRAND.inkSecondary }}>
            {rows.length} periodos cargados · {procesos.length} procesos · {pciByProveedor.size} proveedores de combustible
          </p>
        </header>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Precio promedio energía"
          valor={precioPromedio != null ? formatCOP(precioPromedio) : "—"}
          unidad="/kWh"
          delta={deltaPrecio}
          sub={periodos.length > 0 ? `Promedio ${periodos.length} periodos` : undefined}
        />
        <KpiCard
          label="kWh/Ton Clínker"
          valor={clinkerKwhProm != null ? clinkerKwhProm.toFixed(1) : "—"}
          sub={clinkerKwh.length > 0 ? `${clinkerKwh.length} periodos` : "Sin datos"}
        />
        <KpiCard
          label="PCI ponderado horno"
          valor={pciHornoProm != null ? Math.round(pciHornoProm).toLocaleString("es-CO") : "—"}
          unidad="kcal/kg"
          sub={pciHornoVals.length > 0 ? "Ponderado todos meses" : "Sin datos"}
        />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border rounded-xl shadow-sm p-12 text-center" style={{ borderColor: BRAND.border }}>
          <p className="text-sm" style={{ color: BRAND.inkSecondary }}>No hay parámetros energéticos cargados.</p>
        </div>
      ) : (
        <>
          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border }}>
              <h2 className="text-base font-semibold mb-1" style={{ color: BRAND.ink }}>Precios eléctricos por periodo</h2>
              <p className="text-xs mb-4" style={{ color: BRAND.inkMuted }}>COP/kWh — contrato + restricciones + cargos</p>
              <PreciosLineChart data={lineData} />
            </div>

            <div className="bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border }}>
              <h2 className="text-base font-semibold mb-1" style={{ color: BRAND.ink }}>Consumo kWh/Ton por proceso</h2>
              <p className="text-xs mb-4" style={{ color: BRAND.inkMuted }}>Comparativa por periodo</p>
              {consumoData.length > 0 ? (
                <ConsumoBarChart data={consumoData} periodos={periodos} />
              ) : (
                <p className="text-sm" style={{ color: BRAND.inkMuted }}>Sin datos de consumo por proceso.</p>
              )}
            </div>
          </div>

          {mixData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border }}>
                <h2 className="text-base font-semibold mb-1" style={{ color: BRAND.ink }}>PCI Combustibles por proveedor</h2>
                <p className="text-xs mb-4" style={{ color: BRAND.inkMuted }}>kcal/Ton — promedio del año</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: BRAND.bgBand }}>
                      <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>Proveedor</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>PCI prom</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs uppercase tracking-wide" style={{ color: BRAND.inkSecondary }}>% del mix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mixData.map((m, i) => {
                      const totalMix = mixData.reduce((s, x) => s + x.value, 0);
                      const pct = totalMix > 0 ? (m.value / totalMix) * 100 : 0;
                      return (
                        <tr key={m.name} className="border-b" style={{ borderColor: BRAND.border }}>
                          <td className="px-3 py-2.5 flex items-center gap-2">
                            <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.chart[i % BRAND.chart.length] }} />
                            <span style={{ color: BRAND.ink }}>{m.name}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: BRAND.inkSecondary }}>
                            {Math.round(m.value).toLocaleString("es-CO")}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: BRAND.ink }}>
                            {pct.toFixed(1)} %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border rounded-xl shadow-sm p-6" style={{ borderColor: BRAND.border }}>
                <h2 className="text-base font-semibold mb-1" style={{ color: BRAND.ink }}>Mix energético</h2>
                <p className="text-xs mb-4" style={{ color: BRAND.inkMuted }}>Distribución PCI</p>
                <MixDonut data={mixData} />
              </div>
            </div>
          )}

          {/* ── Tabla detallada (existente) ── */}
          <div>
            <h2 className="text-base font-semibold mb-3" style={{ color: BRAND.ink }}>Detalle por periodo</h2>
            <EnergiaTable parametros={rows} periodos={periodos} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label, valor, unidad, sub, delta,
}: {
  label: string;
  valor: string;
  unidad?: string;
  sub?: string;
  delta?: number | null;
}) {
  const dColor = delta == null ? BRAND.inkMuted : delta > 0 ? BRAND.danger : BRAND.success;
  return (
    <div className="bg-white rounded-xl shadow-sm p-5" style={{ borderTop: `4px solid ${BRAND.primary}`, border: `1px solid ${BRAND.border}` }}>
      <p className="text-xs uppercase tracking-wide font-medium mb-2" style={{ color: BRAND.inkMuted }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: BRAND.ink }}>
        {valor}
        {unidad && <span className="text-sm font-normal ml-1" style={{ color: BRAND.inkMuted }}>{unidad}</span>}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {delta != null && (
          <span className="text-xs font-semibold tabular-nums" style={{ color: dColor }}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} %
          </span>
        )}
        {sub && <span className="text-xs" style={{ color: BRAND.inkMuted }}>{sub}</span>}
      </div>
    </div>
  );
}
