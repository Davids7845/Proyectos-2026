// Cuadro detallado por proceso — réplica de la hoja "Costo" del Excel para un ORD.
// Muestra: Concepto | Consumo | Precio Unit | Costo/Ton | Costo Total (COP)

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

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

export default async function ProcesoDetalleePage({ params, searchParams }: PageProps) {
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

  // Último run exitoso
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id, estado, iniciado_en")
    .eq("version_id", id)
    .in("estado", ["exitoso"])
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Obtener periodos del costo_proceso
  const { data: costoProcPeriodos } = await supabase
    .from("costo_proceso")
    .select("periodo, costo_por_ton, costo_total")
    .eq("run_id", lastRun?.id ?? "")
    .eq("proceso_id", proceso.id)
    .order("periodo");

  const periodos = (costoProcPeriodos ?? []).map(r => r.periodo as string);
  const selectedPeriodo = sp.periodo ?? periodos[periodos.length - 1] ?? null;

  // Rendimientos para produccion_ton
  const { data: rendimiento } = await supabase
    .from("rendimientos")
    .select("produccion_ton")
    .eq("version_id", id)
    .eq("proceso_id", proceso.id)
    .eq("periodo", selectedPeriodo ?? "")
    .maybeSingle();
  const produccionTon = Number(rendimiento?.produccion_ton ?? 0);

  // Cargar log del proceso para el período seleccionado
  const { data: logRows } = selectedPeriodo && lastRun ? await supabase
    .from("calculation_log")
    .select("id, calculo_tipo, material_id, concepto, valor_resultado, parametros_entrada, unidad")
    .eq("run_id", lastRun.id)
    .eq("proceso_id", proceso.id)
    .eq("periodo", selectedPeriodo)
    .order("nivel_jerarquia", { ascending: false })
    : { data: [] };

  // Cargar receta para este proceso/periodo (para pct)
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

  // Cargar nombres de materiales
  const matIds = (logRows ?? []).map(r => r.material_id).filter(Boolean) as string[];
  const { data: materialesRaw } = matIds.length > 0
    ? await supabase.from("materiales").select("id, nombre, codigo").in("id", matIds)
    : { data: [] };
  const matById = new Map<string, { nombre: string; codigo: string }>();
  for (const m of materialesRaw ?? []) matById.set(m.id, { nombre: m.nombre, codigo: m.codigo });

  // Construir filas del cuadro
  const componentes: ComponenteRow[] = [];
  let total_costo_ton = 0;

  for (const row of logRows ?? []) {
    const tipo = row.calculo_tipo as string;
    const params = row.parametros_entrada as Record<string, unknown>;

    if (tipo === "precio_componente_directo" || tipo === "precio_componente_derivado") {
      if (!row.material_id) continue;
      const mat = matById.get(row.material_id);
      const pct = pctByMat.get(row.material_id) ?? null;
      componentes.push({
        concepto: mat?.nombre ?? row.material_id,
        consumo: pct,
        consumo_unidad: "Ton/Ton",
        precio_unit: row.valor_resultado,
        costo_por_ton: pct != null ? row.valor_resultado * pct : 0,
        calc_id: row.id,
        tipo: "mp",
      });
      if (pct != null) total_costo_ton += row.valor_resultado * pct;

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
      componentes.push({
        concepto: String(params.codigo ?? row.concepto ?? "Costo fijo"),
        consumo: 1,
        consumo_unidad: "Ton/Ton",
        precio_unit: row.valor_resultado,
        costo_por_ton: row.valor_resultado,
        calc_id: row.id,
        tipo: "fijo",
      });
      total_costo_ton += row.valor_resultado;
    }
  }

  const costo_total_cop = total_costo_ton * produccionTon;
  const costoRow = (costoProcPeriodos ?? []).find(r => r.periodo === selectedPeriodo);

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${id}/costo`} className="hover:underline">Costo</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">ORD {ordNum} — {proceso.nombre}</span>
      </nav>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            <span className="text-gray-400 mr-2 text-base">ORD {ordNum}</span>
            {proceso.nombre}
          </h1>
          {lastRun && (
            <p className="text-xs text-gray-400 mt-0.5">
              Run: {new Date(lastRun.iniciado_en).toLocaleString("es-CO")} · {lastRun.estado}
            </p>
          )}
        </div>

        {/* Selector de período */}
        {periodos.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Período:</span>
            <div className="flex gap-1">
              {periodos.map(p => (
                <Link
                  key={p}
                  href={`/versiones/${id}/costo/proceso/${ordNum}?periodo=${p}`}
                  className={`px-2 py-1 rounded text-xs border ${
                    p === selectedPeriodo
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {fmtPeriodoCorto(p)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {!lastRun ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">No hay cálculos para esta versión.</p>
          <Link href={`/versiones/${id}/calcular`} className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            Ir a calcular →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">
                {selectedPeriodo ? fmtPeriodoCompleto(selectedPeriodo) : "—"}
              </span>
              {produccionTon > 0 && (
                <span className="text-xs text-gray-400 ml-3">
                  Producción: {produccionTon.toLocaleString("es-CO", { maximumFractionDigits: 0 })} Ton
                </span>
              )}
            </div>
            {costoRow && (
              <div className="text-right">
                <span className="text-xs text-gray-500">Costo total /Ton: </span>
                <span className="text-sm font-semibold tabular-nums">
                  {Number(costoRow.costo_por_ton).toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP
                </span>
              </div>
            )}
          </div>

          {componentes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No hay componentes calculados para este proceso en el período seleccionado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">Concepto</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">Consumo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs">Und</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">Precio Unit (COP)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">Costo/Ton (COP)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-600">Total periodo (COP)</th>
                </tr>
              </thead>
              <tbody>
                {componentes.map((c, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-900">
                      {c.calc_id ? (
                        <Link
                          href={`/versiones/${id}/calculos/${c.calc_id}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {c.concepto}
                        </Link>
                      ) : c.concepto}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${tipoColor(c.tipo)}`}>
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {c.consumo != null ? c.consumo.toLocaleString("es-CO", { maximumFractionDigits: 4 }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{c.consumo_unidad}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {c.precio_unit != null
                        ? c.precio_unit.toLocaleString("es-CO", { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {c.costo_por_ton.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {produccionTon > 0
                        ? (c.costo_por_ton * produccionTon).toLocaleString("es-CO", { maximumFractionDigits: 0 })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-gray-900" colSpan={4}>
                    Total {proceso.nombre}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900">
                    {total_costo_ton.toLocaleString("es-CO", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900">
                    {produccionTon > 0
                      ? costo_total_cop.toLocaleString("es-CO", { maximumFractionDigits: 0 })
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function fmtPeriodoCorto(p: string) {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", {
    month: "short", year: "2-digit", timeZone: "UTC",
  });
}

function fmtPeriodoCompleto(p: string) {
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

function tipoColor(tipo: string) {
  switch (tipo) {
    case "mp":          return "bg-blue-50 text-blue-600";
    case "energia":     return "bg-yellow-50 text-yellow-700";
    case "combustible": return "bg-orange-50 text-orange-700";
    case "fijo":        return "bg-gray-100 text-gray-600";
    default:            return "bg-gray-100 text-gray-600";
  }
}
