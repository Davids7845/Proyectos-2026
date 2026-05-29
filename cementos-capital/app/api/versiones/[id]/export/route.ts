import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";
export const maxDuration = 30;

function fmtPeriodo(p: string) {
  const d = new Date(p + "T00:00:00");
  return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const compareIdParam = req.nextUrl.searchParams.get("compare");

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado, precios_fijos")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });

  // Último run exitoso
  const { data: lastRun } = await supabase
    .from("calculation_runs")
    .select("id, estado, iniciado_en, duracion_ms, total_calculos")
    .eq("version_id", versionId)
    .eq("estado", "exitoso")
    .order("iniciado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastRun) {
    return NextResponse.json({ error: "No hay cálculos exitosos para exportar" }, { status: 400 });
  }

  // Cargar datos en paralelo
  const [
    { data: costoRows },
    { data: precios },
    { data: procesosActivos },
    { data: maestroSapRows },
    { data: movimientosRows },
    { data: rendimientosRows },
  ] = await Promise.all([
    supabase
      .from("costo_proceso")
      .select("periodo, costo_por_ton, costo_total, costo_materia_prima, costo_energia, costo_combustible, costo_por_ton_arrastrado, costo_total_arrastrado, proceso:procesos(id, ord, nombre, orden_topologico)")
      .eq("run_id", lastRun.id),
    supabase
      .from("precios_insumos")
      .select("periodo, precio_cop, material:materiales(codigo, nombre)")
      .eq("version_id", versionId)
      .order("periodo"),
    supabase
      .from("procesos")
      .select("id, ord, nombre, orden_topologico, material")
      .eq("activo", true)
      .order("orden_topologico"),
    supabase
      .from("maestro_sap")
      .select("material_id, proceso_id, clase_costo_id, orden_sap, clasificacion, tipo_insumo, material:materiales(codigo, nombre), proceso:procesos(ord, nombre), clase_costo:clases_costo(codigo, denominacion)"),
    supabase
      .from("v_movimientos_base")
      .select("periodo, tipo_movimiento, clase_costo_codigo, clase_costo_denom, valor_monetario, cantidad, unidad, proceso_nombre, ord, material_nombre, orden_sap, clasificacion, tipo_insumo")
      .eq("version_id", versionId)
      .eq("run_id", lastRun.id)
      .order("ord")
      .order("clase_costo_codigo"),
    supabase
      .from("rendimientos")
      .select("proceso_id, periodo, produccion_ton, proceso:procesos(ord, nombre)")
      .eq("version_id", versionId)
      .order("periodo"),
  ]);

  const rows = (costoRows ?? []) as Array<{
    periodo: string;
    costo_por_ton: number;
    costo_total: number;
    costo_materia_prima: number | null;
    costo_energia: number | null;
    costo_combustible: number | null;
    costo_por_ton_arrastrado: number | null;
    costo_total_arrastrado: number | null;
    proceso: { id: string; ord: number; nombre: string; orden_topologico: number } | null;
  }>;

  const periodos = Array.from(new Set(rows.map(r => r.periodo))).sort();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Cementos Capital — Budget Engine";
  wb.created = new Date();

  // ─── Hoja 1: Costo/Ton ───────────────────────────────────────────────────
  const shCosto = wb.addWorksheet("Costo por Ton", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });

  // Header row 1: version info
  shCosto.getRow(1).getCell(1).value = `Versión: ${version.nombre}`;
  shCosto.getRow(1).getCell(1).font = { bold: true, size: 12 };
  shCosto.getRow(1).getCell(2).value = `Run: ${new Date(lastRun.iniciado_en).toLocaleString("es-CO")}`;

  // Header row 2: column headers
  const headerRow = shCosto.getRow(2);
  headerRow.getCell(1).value = "Proceso";
  headerRow.getCell(1).font = { bold: true };
  headerRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

  periodos.forEach((per, i) => {
    const cell = headerRow.getCell(i + 2);
    cell.value = fmtPeriodo(per);
    cell.font = { bold: true };
    cell.alignment = { horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  // Build pivot map
  const byProceso = new Map<string, Map<string, number>>();
  const procesoMeta = new Map<string, { ord: number; nombre: string; orden_topologico: number }>();

  for (const r of rows) {
    if (!r.proceso) continue;
    const pid = r.proceso.id;
    if (!byProceso.has(pid)) byProceso.set(pid, new Map());
    byProceso.get(pid)!.set(r.periodo, Number(r.costo_por_ton));
    procesoMeta.set(pid, { ord: r.proceso.ord, nombre: r.proceso.nombre, orden_topologico: r.proceso.orden_topologico });
  }

  const filas = Array.from(byProceso.keys())
    .sort((a, b) => (procesoMeta.get(a)?.orden_topologico ?? 99) - (procesoMeta.get(b)?.orden_topologico ?? 99));

  let rowIdx = 3;
  for (const pid of filas) {
    const meta = procesoMeta.get(pid)!;
    const dataRow = shCosto.getRow(rowIdx++);
    dataRow.getCell(1).value = `${meta.ord} - ${meta.nombre}`;
    periodos.forEach((per, i) => {
      const v = byProceso.get(pid)?.get(per);
      const cell = dataRow.getCell(i + 2);
      cell.value = v != null ? v : null;
      cell.numFmt = "#,##0";
      cell.alignment = { horizontal: "right" };
    });
  }

  shCosto.getColumn(1).width = 34;
  periodos.forEach((_, i) => {
    shCosto.getColumn(i + 2).width = 12;
  });

  // ─── Hoja 2: Costo Total (COP) ───────────────────────────────────────────
  const shTotal = wb.addWorksheet("Costo Total COP", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });

  shTotal.getRow(1).getCell(1).value = `Versión: ${version.nombre}`;
  shTotal.getRow(1).getCell(1).font = { bold: true, size: 12 };

  const headerTotal = shTotal.getRow(2);
  headerTotal.getCell(1).value = "Proceso";
  headerTotal.getCell(1).font = { bold: true };
  headerTotal.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  periodos.forEach((per, i) => {
    const cell = headerTotal.getCell(i + 2);
    cell.value = fmtPeriodo(per);
    cell.font = { bold: true };
    cell.alignment = { horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  const byProcesoTotal = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.proceso) continue;
    const pid = r.proceso.id;
    if (!byProcesoTotal.has(pid)) byProcesoTotal.set(pid, new Map());
    byProcesoTotal.get(pid)!.set(r.periodo, Number(r.costo_total));
  }

  let rowIdx2 = 3;
  for (const pid of filas) {
    const meta = procesoMeta.get(pid)!;
    const dataRow = shTotal.getRow(rowIdx2++);
    dataRow.getCell(1).value = `${meta.ord} - ${meta.nombre}`;
    periodos.forEach((per, i) => {
      const v = byProcesoTotal.get(pid)?.get(per);
      const cell = dataRow.getCell(i + 2);
      cell.value = v != null ? v : null;
      cell.numFmt = "#,##0";
      cell.alignment = { horizontal: "right" };
    });
  }

  shTotal.getColumn(1).width = 34;
  periodos.forEach((_, i) => {
    shTotal.getColumn(i + 2).width = 14;
  });

  // ─── Hoja 3: Precios insumos ─────────────────────────────────────────────
  const shPrecios = wb.addWorksheet("Precios Insumos");

  shPrecios.getRow(1).values = ["Material (código)", "Material (nombre)", "Periodo", "Precio COP/Ton"];
  shPrecios.getRow(1).font = { bold: true };
  shPrecios.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  shPrecios.getColumn(1).width = 18;
  shPrecios.getColumn(2).width = 32;
  shPrecios.getColumn(3).width = 12;
  shPrecios.getColumn(4).width = 16;

  let pRow = 2;
  for (const p of (precios ?? []) as any[]) {
    shPrecios.getRow(pRow).values = [
      p.material?.codigo ?? "",
      p.material?.nombre ?? "",
      fmtPeriodo(p.periodo),
      p.precio_cop != null ? Number(p.precio_cop) : null,
    ];
    const priceCell = shPrecios.getRow(pRow).getCell(4);
    priceCell.numFmt = "#,##0";
    priceCell.alignment = { horizontal: "right" };
    pRow++;
  }

  // ─── Hoja 4: Resumen run ─────────────────────────────────────────────────
  const shResumen = wb.addWorksheet("Resumen");
  const summary = [
    ["Versión", version.nombre],
    ["Estado versión", version.estado],
    ["Run ID", lastRun.id],
    ["Iniciado", new Date(lastRun.iniciado_en).toLocaleString("es-CO")],
    ["Duración (ms)", lastRun.duracion_ms ?? "—"],
    ["Total cálculos", lastRun.total_calculos ?? 0],
    ["Periodos", periodos.length],
    ["Procesos calculados", filas.length],
    ["Exportado", new Date().toLocaleString("es-CO")],
  ];
  summary.forEach(([label, val], i) => {
    shResumen.getRow(i + 1).values = [label, val];
    shResumen.getRow(i + 1).getCell(1).font = { bold: true };
  });
  shResumen.getColumn(1).width = 22;
  shResumen.getColumn(2).width = 36;

  // ─── Hoja 5: Desglose por proceso ────────────────────────────────────────
  const { data: logRows } = await supabase
    .from("calculation_log")
    .select("calculo_tipo, proceso_id, material_id, periodo, valor_resultado, concepto, parametros_entrada")
    .eq("run_id", lastRun.id)
    .in("calculo_tipo", [
      "precio_componente_directo", "precio_componente_derivado",
      "costo_energia_proceso", "costo_componente_derivado_termico", "costo_fijo_proceso",
    ]);

  // Cargar recetas para pct
  const { data: recetasEx } = await supabase
    .from("recetas")
    .select("proceso_id, periodo, receta_lineas(material_id, porcentaje)")
    .eq("version_id", versionId);
  const pctMapEx = new Map<string, number>();
  for (const r of recetasEx ?? []) {
    for (const ln of (r as any).receta_lineas ?? []) {
      pctMapEx.set(`${r.proceso_id}|${ln.material_id}|${r.periodo}`, Number(ln.porcentaje));
    }
  }

  // Materiales para nombres
  const matIdsEx = Array.from(new Set((logRows ?? []).map(r => r.material_id).filter(Boolean))) as string[];
  const { data: matsEx } = matIdsEx.length > 0
    ? await supabase.from("materiales").select("id, nombre").in("id", matIdsEx)
    : { data: [] };
  const matNombreEx = new Map<string, string>();
  for (const m of matsEx ?? []) matNombreEx.set(m.id, m.nombre);

  const shDesglose = wb.addWorksheet("Desglose por Proceso");
  shDesglose.getRow(1).values = [
    "Proceso", "ORD", "Período", "Concepto", "Tipo", "Consumo", "Precio Unit", "Costo/Ton",
  ];
  shDesglose.getRow(1).font = { bold: true };
  shDesglose.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  [34, 6, 10, 30, 14, 12, 16, 14].forEach((w, i) => {
    shDesglose.getColumn(i + 1).width = w;
  });

  let dsRow = 2;
  for (const log of (logRows ?? []) as any[]) {
    const proc = procesoMeta.get(log.proceso_id ?? "");
    const params = log.parametros_entrada as Record<string, unknown> ?? {};
    let concepto = "";
    let consumo: number | null = null;
    let precioUnit: number | null = null;
    let costoTon = Number(log.valor_resultado);
    let tipo = "";

    if (log.calculo_tipo === "precio_componente_directo" || log.calculo_tipo === "precio_componente_derivado") {
      concepto = log.material_id ? (matNombreEx.get(log.material_id) ?? log.material_id) : log.concepto;
      const pct = log.material_id ? (pctMapEx.get(`${log.proceso_id}|${log.material_id}|${log.periodo}`) ?? null) : null;
      consumo = pct;
      precioUnit = costoTon;
      costoTon = pct != null ? costoTon * pct : 0;
      tipo = "mp";
    } else if (log.calculo_tipo === "costo_energia_proceso") {
      concepto = "Energía Eléctrica";
      consumo = Number(params.kwh_ton ?? 0) || null;
      precioUnit = consumo && consumo > 0 ? costoTon / consumo : null;
      tipo = "energia";
    } else if (log.calculo_tipo === "costo_componente_derivado_termico") {
      concepto = log.material_id ? (matNombreEx.get(log.material_id) ?? log.concepto) : log.concepto;
      consumo = Number(params.consumo ?? 0) || null;
      precioUnit = Number(params.precio_arrastrado ?? 0) || null;
      tipo = "combustible";
    } else if (log.calculo_tipo === "costo_fijo_proceso") {
      concepto = String(params.codigo ?? log.concepto ?? "Costo fijo");
      consumo = 1;
      precioUnit = costoTon;
      tipo = "fijo";
    }

    if (!concepto) continue;
    const row = shDesglose.getRow(dsRow++);
    row.getCell(1).value = proc?.nombre ?? log.proceso_id ?? "";
    row.getCell(2).value = proc?.ord ?? null;
    row.getCell(3).value = fmtPeriodo(log.periodo);
    row.getCell(4).value = concepto;
    row.getCell(5).value = tipo;
    row.getCell(6).value = consumo;
    if (consumo != null) { row.getCell(6).numFmt = "#,##0.0000"; row.getCell(6).alignment = { horizontal: "right" }; }
    row.getCell(7).value = precioUnit;
    if (precioUnit != null) { row.getCell(7).numFmt = "#,##0"; row.getCell(7).alignment = { horizontal: "right" }; }
    row.getCell(8).value = costoTon || null;
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(8).alignment = { horizontal: "right" };
  }

  // ─── Hoja 6: ORD — lista de procesos activos ────────────────────────────────
  const shOrd = wb.addWorksheet("ORD");
  shOrd.getRow(1).values = ["ORD", "Proceso", "Material", "Orden Topológico"];
  shOrd.getRow(1).font = { bold: true };
  shOrd.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  shOrd.getColumn(1).width = 6;
  shOrd.getColumn(2).width = 30;
  shOrd.getColumn(3).width = 22;
  shOrd.getColumn(4).width = 18;
  let ordRow = 2;
  for (const p of (procesosActivos ?? []) as any[]) {
    const r = shOrd.getRow(ordRow++);
    r.getCell(1).value = p.ord;
    r.getCell(2).value = p.nombre;
    r.getCell(3).value = p.material ?? "";
    r.getCell(4).value = p.orden_topologico;
    r.getCell(1).alignment = { horizontal: "center" };
  }

  // ─── Hoja 7: Maestro SAP ────────────────────────────────────────────────────
  const shMaestro = wb.addWorksheet("Maestro SAP");
  shMaestro.getRow(1).values = [
    "ORD", "Proceso", "Material (código)", "Material (nombre)", "Clase Costo", "Denominación Clase", "Orden SAP", "Clasificación", "Tipo Insumo",
  ];
  shMaestro.getRow(1).font = { bold: true };
  shMaestro.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  [6, 26, 18, 28, 14, 28, 12, 20, 20].forEach((w, i) => { shMaestro.getColumn(i + 1).width = w; });
  let mRow = 2;
  const maestroSorted = [...(maestroSapRows ?? [])] as any[];
  maestroSorted.sort((a, b) => (a.proceso?.ord ?? 99) - (b.proceso?.ord ?? 99));
  for (const m of maestroSorted) {
    const r = shMaestro.getRow(mRow++);
    r.getCell(1).value = m.proceso?.ord ?? null;
    r.getCell(2).value = m.proceso?.nombre ?? "";
    r.getCell(3).value = m.material?.codigo ?? "";
    r.getCell(4).value = m.material?.nombre ?? "";
    r.getCell(5).value = m.clase_costo?.codigo ?? "";
    r.getCell(6).value = m.clase_costo?.denominacion ?? "";
    r.getCell(7).value = m.orden_sap ?? "";
    r.getCell(8).value = m.clasificacion ?? "";
    r.getCell(9).value = m.tipo_insumo ?? "";
    r.getCell(1).alignment = { horizontal: "center" };
  }

  // ─── Hoja 8: Base SAP (movimientos_contables) ───────────────────────────────
  const hasSap = (movimientosRows ?? []).length > 0;
  const shBase = wb.addWorksheet("Base SAP");
  shBase.getRow(1).values = [
    "Período", "ORD", "Proceso", "Tipo", "Clase Costo", "Denominación Clase",
    "Material", "Clasificación", "Tipo Insumo", "Cantidad", "Unidad", "Valor COP", "Orden SAP",
  ];
  shBase.getRow(1).font = { bold: true };
  shBase.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  [10, 5, 26, 10, 14, 28, 22, 18, 18, 14, 8, 16, 10].forEach((w, i) => { shBase.getColumn(i + 1).width = w; });
  let bRow = 2;
  if (hasSap) {
    for (const m of (movimientosRows ?? []) as any[]) {
      const r = shBase.getRow(bRow++);
      r.getCell(1).value = m.periodo ? fmtPeriodo(m.periodo) : "";
      r.getCell(2).value = m.ord ?? null;
      r.getCell(3).value = m.proceso_nombre ?? "";
      r.getCell(4).value = m.tipo_movimiento ?? "";
      r.getCell(5).value = m.clase_costo_codigo ?? "";
      r.getCell(6).value = m.clase_costo_denom ?? "";
      r.getCell(7).value = m.material_nombre ?? "";
      r.getCell(8).value = m.clasificacion ?? "";
      r.getCell(9).value = m.tipo_insumo ?? "";
      r.getCell(10).value = m.cantidad != null ? Number(m.cantidad) : null;
      r.getCell(10).numFmt = "#,##0.00"; r.getCell(10).alignment = { horizontal: "right" };
      r.getCell(11).value = m.unidad ?? "";
      r.getCell(12).value = m.valor_monetario != null ? Number(m.valor_monetario) : null;
      r.getCell(12).numFmt = "#,##0"; r.getCell(12).alignment = { horizontal: "right" };
      r.getCell(13).value = m.orden_sap ?? "";
    }
  } else {
    shBase.getRow(2).getCell(1).value = "Sin movimientos SAP (sap_enabled=false en esta versión)";
    shBase.getRow(2).getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
  }

  // ─── Hoja 9: TD — Pivot proceso × clase_costo ───────────────────────────────
  const shTd = wb.addWorksheet("TD");
  if (hasSap) {
    // Aggregate valor_monetario by (proceso_nombre+ord, clase_costo_codigo)
    const tdByProc = new Map<string, { ord: number; nombre: string; byClase: Map<string, number> }>();
    const tdClases = new Set<string>();
    for (const m of (movimientosRows ?? []) as any[]) {
      if (m.tipo_movimiento !== "entrada") continue;
      const pk = `${m.ord ?? 99}|${m.proceso_nombre ?? ""}`;
      if (!tdByProc.has(pk)) tdByProc.set(pk, { ord: m.ord ?? 99, nombre: m.proceso_nombre ?? "", byClase: new Map() });
      const cc = m.clase_costo_codigo ?? "SIN_CLASE";
      tdClases.add(cc);
      const cur = tdByProc.get(pk)!;
      cur.byClase.set(cc, (cur.byClase.get(cc) ?? 0) + Number(m.valor_monetario ?? 0));
    }
    const tdClasesSorted = Array.from(tdClases).sort();
    const tdProcsSorted = Array.from(tdByProc.values()).sort((a, b) => a.ord - b.ord);

    const hdrTd = shTd.getRow(1);
    hdrTd.getCell(1).value = "ORD"; hdrTd.getCell(2).value = "Proceso";
    tdClasesSorted.forEach((cc, i) => { hdrTd.getCell(i + 3).value = cc; });
    hdrTd.font = { bold: true };
    hdrTd.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    shTd.getColumn(1).width = 5; shTd.getColumn(2).width = 28;
    tdClasesSorted.forEach((_, i) => { shTd.getColumn(i + 3).width = 16; });

    let tdRow = 2;
    for (const proc of tdProcsSorted) {
      const r = shTd.getRow(tdRow++);
      r.getCell(1).value = proc.ord;
      r.getCell(2).value = proc.nombre;
      tdClasesSorted.forEach((cc, i) => {
        const v = proc.byClase.get(cc);
        const cell = r.getCell(i + 3);
        cell.value = v ?? null;
        if (v != null) { cell.numFmt = "#,##0"; cell.alignment = { horizontal: "right" }; }
      });
    }
  } else {
    shTd.getRow(1).getCell(1).value = "Sin movimientos SAP para generar pivot.";
    shTd.getRow(1).getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
  }

  // ─── Hoja 10: Costo Arrastrado ───────────────────────────────────────────────
  const shArrastrado = wb.addWorksheet("Costo Arrastrado", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  shArrastrado.getRow(1).getCell(1).value = `Versión: ${version.nombre}`;
  shArrastrado.getRow(1).getCell(1).font = { bold: true, size: 12 };
  const hdrArr = shArrastrado.getRow(2);
  hdrArr.getCell(1).value = "Proceso"; hdrArr.getCell(1).font = { bold: true };
  hdrArr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  periodos.forEach((per, i) => {
    const cell = hdrArr.getCell(i + 2);
    cell.value = fmtPeriodo(per); cell.font = { bold: true };
    cell.alignment = { horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });
  const byProcesoArr = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.proceso) continue;
    const pid = r.proceso.id;
    if (!byProcesoArr.has(pid)) byProcesoArr.set(pid, new Map());
    byProcesoArr.get(pid)!.set(r.periodo, Number(r.costo_por_ton_arrastrado ?? r.costo_por_ton));
  }
  let arrIdx = 3;
  for (const pid of filas) {
    const meta = procesoMeta.get(pid)!;
    const dataRow = shArrastrado.getRow(arrIdx++);
    dataRow.getCell(1).value = `${meta.ord} - ${meta.nombre}`;
    periodos.forEach((per, i) => {
      const v = byProcesoArr.get(pid)?.get(per);
      const cell = dataRow.getCell(i + 2);
      cell.value = v != null ? v : null;
      cell.numFmt = "#,##0"; cell.alignment = { horizontal: "right" };
    });
  }
  shArrastrado.getColumn(1).width = 34;
  periodos.forEach((_, i) => { shArrastrado.getColumn(i + 2).width = 12; });

  // ─── Hoja 11: CA Detalle — Costo Arrastrado desglosado por componente ────────
  // Muestra los 4 bloques (Clinker explotado, UG, ART, Fibro) para el último período.
  // Columna Real: pendiente integración costos_reales.
  {
    const periodoCA = periodos[periodos.length - 1]; // último período disponible
    const shCA = wb.addWorksheet("CA Detalle");

    const ORDS_CA = [3, 5, 6, 7, 16] as const;
    const { data: procesosCA } = await supabase
      .from("procesos")
      .select("id, ord, nombre")
      .in("ord", [...ORDS_CA])
      .eq("activo", true);

    const byOrdCA = new Map((procesosCA ?? []).map((p: { ord: number; id: string; nombre: string }) => [p.ord, p]));
    const procesoIdsCA = (procesosCA ?? []).map((p: { id: string }) => p.id);

    const LOG_TIPOS_CA = [
      "precio_componente_directo", "precio_componente_derivado",
      "costo_componente_derivado_termico", "costo_energia_proceso", "costo_fijo_proceso",
    ];

    const [{ data: logsCA }, { data: recetasCA }] = await Promise.all([
      supabase
        .from("calculation_log")
        .select("id, calculo_tipo, proceso_id, material_id, concepto, valor_resultado, parametros_entrada")
        .eq("run_id", lastRun.id)
        .eq("periodo", periodoCA)
        .in("proceso_id", procesoIdsCA)
        .in("calculo_tipo", LOG_TIPOS_CA),
      supabase
        .from("recetas")
        .select("proceso_id, periodo, receta_lineas(material_id, porcentaje)")
        .eq("version_id", versionId)
        .in("proceso_id", procesoIdsCA),
    ]);

    const pctCA = new Map<string, number>();
    for (const r of (recetasCA ?? []) as Array<{ proceso_id: string; periodo: string; receta_lineas: Array<{ material_id: string; porcentaje: number }> }>) {
      const isPeriodo = r.periodo === periodoCA;
      for (const ln of r.receta_lineas ?? []) {
        const key = `${r.proceso_id}|${ln.material_id}`;
        if (isPeriodo || !pctCA.has(key)) pctCA.set(key, Number(ln.porcentaje));
      }
    }

    const matIdsCA = Array.from(new Set((logsCA ?? []).map((l: { material_id: string | null }) => l.material_id).filter(Boolean))) as string[];
    const { data: matsCA } = matIdsCA.length > 0
      ? await supabase.from("materiales").select("id, nombre").in("id", matIdsCA)
      : { data: [] };
    const matNombreCA = new Map<string, string>();
    for (const m of matsCA ?? []) matNombreCA.set(m.id, m.nombre);

    type LogCA = { calculo_tipo: string; proceso_id: string; material_id: string | null; concepto: string | null; valor_resultado: number; parametros_entrada: Record<string, unknown> | null };
    const logsByProcCA = new Map<string, LogCA[]>();
    for (const log of (logsCA ?? []) as LogCA[]) {
      if (!logsByProcCA.has(log.proceso_id)) logsByProcCA.set(log.proceso_id, []);
      logsByProcCA.get(log.proceso_id)!.push(log);
    }

    const resolveComp = (log: LogCA, consumoOverride?: number): { nombre: string; tipo: string; consumo: number; costoUnit: number; total: number } | null => {
      const p = (log.parametros_entrada ?? {}) as Record<string, unknown>;
      if (log.calculo_tipo === "precio_componente_directo" || log.calculo_tipo === "precio_componente_derivado") {
        const consumo = consumoOverride ?? (log.material_id ? (pctCA.get(`${log.proceso_id}|${log.material_id}`) ?? 0) : 0);
        const costoUnit = Number(log.valor_resultado);
        return { nombre: log.material_id ? (matNombreCA.get(log.material_id) ?? log.concepto ?? "") : (log.concepto ?? ""), tipo: "MP", consumo, costoUnit, total: consumo * costoUnit };
      }
      if (log.calculo_tipo === "costo_componente_derivado_termico") {
        const consumo = consumoOverride ?? Number(p.consumo ?? 0);
        return { nombre: log.material_id ? (matNombreCA.get(log.material_id) ?? log.concepto ?? "") : (log.concepto ?? ""), tipo: "Combust.", consumo, costoUnit: Number(p.precio_arrastrado ?? 0), total: Number(log.valor_resultado) };
      }
      if (log.calculo_tipo === "costo_energia_proceso") {
        const consumo = Number(p.kwh_ton ?? 0);
        const total = Number(log.valor_resultado);
        return { nombre: "Energía Eléctrica", tipo: "Energía", consumo, costoUnit: consumo > 0 ? total / consumo : 0, total };
      }
      if (log.calculo_tipo === "costo_fijo_proceso") {
        const val = Number(log.valor_resultado);
        if (val === 0) return null;
        return { nombre: String(p.codigo ?? log.concepto ?? "Costo fijo"), tipo: "Fijo", consumo: 1, costoUnit: val, total: val };
      }
      return null;
    };

    // Header
    shCA.getRow(1).getCell(1).value = `Versión: ${version.nombre} — Período: ${fmtPeriodo(periodoCA)}`;
    shCA.getRow(1).getCell(1).font = { bold: true, size: 12 };
    const hdrCA = shCA.getRow(2);
    ["Componente", "Tipo", "Consumo Ppto", "Costo Unit Ppto", "Aporte Ppto", "Consumo Real", "Costo Unit Real", "Aporte Real"].forEach((h, i) => {
      const cell = hdrCA.getCell(i + 1);
      cell.value = h; cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
      cell.alignment = { horizontal: i > 1 ? "right" : "left" };
    });
    [42, 10, 14, 16, 16, 14, 16, 16].forEach((w, i) => { shCA.getColumn(i + 1).width = w; });

    let caRow = 3;

    const BLOQUES_CA = [
      { label: "CLINKER (Crudo explotado + componentes propios)", ord: 5, explodeCrudo: true },
      { label: "CEMENTO UG", ord: 6, explodeCrudo: false },
      { label: "CEMENTO ART", ord: 7, explodeCrudo: false },
      { label: "FIBROCEMENTO", ord: 16, explodeCrudo: false },
    ];

    // Crudo consumption in Clinker
    const proc5CA = byOrdCA.get(5) as { id: string } | undefined;
    const proc3CA = byOrdCA.get(3) as { id: string } | undefined;
    const logs5CA = logsByProcCA.get(proc5CA?.id ?? "") ?? [];
    const crudoDerCA = logs5CA.find((l: LogCA) => l.calculo_tipo === "precio_componente_derivado");
    const consumoCrudo = crudoDerCA?.material_id ? (pctCA.get(`${proc5CA!.id}|${crudoDerCA.material_id}`) ?? 0) : 0;

    for (const bloque of BLOQUES_CA) {
      // Section header
      const hRow = shCA.getRow(caRow++);
      hRow.getCell(1).value = bloque.label;
      hRow.getCell(1).font = { bold: true, size: 11 };
      hRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6EEF5" } };
      for (let c = 2; c <= 8; c++) {
        hRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6EEF5" } };
      }

      const proc = byOrdCA.get(bloque.ord) as { id: string; nombre: string } | undefined;
      const components: Array<{ nombre: string; tipo: string; consumo: number; costoUnit: number; total: number; isSubrow: boolean }> = [];

      if (bloque.explodeCrudo && proc3CA && consumoCrudo > 0) {
        for (const log of logsByProcCA.get(proc3CA.id) ?? []) {
          const comp = resolveComp(log);
          if (!comp) continue;
          const cs = comp.consumo * consumoCrudo;
          components.push({ ...comp, nombre: `  ↳ ${comp.nombre}`, consumo: cs, total: cs * comp.costoUnit, isSubrow: true });
        }
      }

      if (proc) {
        for (const log of logsByProcCA.get(proc.id) ?? []) {
          if (bloque.explodeCrudo && log.calculo_tipo === "precio_componente_derivado") continue;
          const comp = resolveComp(log);
          if (comp) components.push({ ...comp, isSubrow: false });
        }
      }

      let totalBloque = 0;
      for (const comp of components) {
        const r = shCA.getRow(caRow++);
        r.getCell(1).value = comp.nombre;
        r.getCell(2).value = comp.tipo;
        r.getCell(3).value = comp.consumo || null;
        r.getCell(3).numFmt = "#,##0.0000"; r.getCell(3).alignment = { horizontal: "right" };
        r.getCell(4).value = comp.costoUnit || null;
        r.getCell(4).numFmt = "#,##0"; r.getCell(4).alignment = { horizontal: "right" };
        r.getCell(5).value = comp.total || null;
        r.getCell(5).numFmt = "#,##0"; r.getCell(5).alignment = { horizontal: "right" };
        r.getCell(6).value = null; // Real: TODO
        r.getCell(7).value = null;
        r.getCell(8).value = null;
        if (comp.isSubrow) {
          r.getCell(1).font = { italic: true, color: { argb: "FF486C81" } };
        }
        totalBloque += comp.total;
      }

      // Total row
      const tRow = shCA.getRow(caRow++);
      tRow.getCell(1).value = `TOTAL ${bloque.label}`;
      tRow.getCell(1).font = { bold: true };
      tRow.getCell(5).value = totalBloque || null;
      tRow.getCell(5).numFmt = "#,##0"; tRow.getCell(5).alignment = { horizontal: "right" };
      tRow.getCell(5).font = { bold: true };
      for (let c = 1; c <= 8; c++) {
        tRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FB" } };
      }
      caRow++; // blank spacer
    }

    const noteRow = shCA.getRow(caRow);
    noteRow.getCell(1).value = `Nota: Columna Real pendiente integración costos_reales. Factor Crudo en Clinker: ${consumoCrudo.toFixed(4)}`;
    noteRow.getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
  }

  // ─── Hoja 12: Energía ────────────────────────────────────────────────────────
  const shEnergia = wb.addWorksheet("Energía");
  shEnergia.getRow(1).values = [
    "Período", "ORD", "Proceso", "Producción (Ton)", "kWh/Ton", "kWh Total", "COP/kWh", "Costo Total COP",
  ];
  shEnergia.getRow(1).font = { bold: true };
  shEnergia.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  [10, 5, 26, 16, 12, 16, 12, 18].forEach((w, i) => { shEnergia.getColumn(i + 1).width = w; });
  // Build rendimiento map for production lookup (ord+periodo since the view doesn't expose proceso_id)
  const rendByOrdPer = new Map<string, number>();
  for (const rend of (rendimientosRows ?? []) as any[]) {
    const ord = rend.proceso?.ord;
    if (ord != null) rendByOrdPer.set(`${ord}|${rend.periodo}`, Number(rend.produccion_ton ?? 0));
  }
  // Use movimientos Base SAP for energy rows (clase 7405050003)
  if (hasSap) {
    const energiaMovs = (movimientosRows ?? []).filter((m: any) => m.clase_costo_codigo === "7405050003");
    let eRow = 2;
    for (const m of energiaMovs as any[]) {
      const r = shEnergia.getRow(eRow++);
      const kwh = Number(m.cantidad ?? 0);
      const cop = Number(m.valor_monetario ?? 0);
      const prodKey = `${m.ord}|${m.periodo}`;
      const prod = rendByOrdPer.get(prodKey) ?? 0;
      r.getCell(1).value = m.periodo ? fmtPeriodo(m.periodo) : "";
      r.getCell(2).value = m.ord ?? null;
      r.getCell(3).value = m.proceso_nombre ?? "";
      r.getCell(4).value = prod || null;
      if (prod) { r.getCell(4).numFmt = "#,##0"; r.getCell(4).alignment = { horizontal: "right" }; }
      r.getCell(5).value = prod > 0 ? kwh / prod : null;
      if (prod > 0) { r.getCell(5).numFmt = "#,##0.00"; r.getCell(5).alignment = { horizontal: "right" }; }
      r.getCell(6).value = kwh || null;
      if (kwh) { r.getCell(6).numFmt = "#,##0"; r.getCell(6).alignment = { horizontal: "right" }; }
      r.getCell(7).value = kwh > 0 ? cop / kwh : null;
      if (kwh > 0) { r.getCell(7).numFmt = "#,##0.00"; r.getCell(7).alignment = { horizontal: "right" }; }
      r.getCell(8).value = cop || null;
      if (cop) { r.getCell(8).numFmt = "#,##0"; r.getCell(8).alignment = { horizontal: "right" }; }
    }
  } else {
    // Fallback: use costo_energia from costo_proceso
    let eRow = 2;
    for (const r of rows) {
      if (r.costo_energia == null) continue;
      const row = shEnergia.getRow(eRow++);
      row.getCell(1).value = fmtPeriodo(r.periodo);
      row.getCell(2).value = r.proceso?.ord ?? null;
      row.getCell(3).value = r.proceso?.nombre ?? "";
      row.getCell(8).value = r.costo_energia;
      row.getCell(8).numFmt = "#,##0"; row.getCell(8).alignment = { horizontal: "right" };
    }
  }

  // ─── Hoja 13: Costo sin Consolidar ──────────────────────────────────────────
  // Matriz costo/Ton igual a "Costo por Ton" pero anotando con 🔒 los procesos
  // forzados por precios_fijos_overrides cuando version.precios_fijos = true.
  const { data: pfOverrides } = await (supabase as any)
    .from("precios_fijos_overrides")
    .select("proceso_id, periodo")
    .eq("version_id", versionId);
  const fixedKeys = new Set<string>();
  for (const pf of (pfOverrides ?? []) as Array<{ proceso_id: string; periodo: string }>) {
    fixedKeys.add(`${pf.proceso_id}|${pf.periodo}`);
  }

  const shSinCons = wb.addWorksheet("Costo sin Consolidar", { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  shSinCons.getRow(1).getCell(1).value =
    `Versión: ${version.nombre} — Modo: ${version.precios_fijos ? "Sin Consolidar (precios fijos activos)" : "Consolidado (cascada normal)"}`;
  shSinCons.getRow(1).getCell(1).font = { bold: true, size: 12 };

  const headerSC = shSinCons.getRow(2);
  headerSC.getCell(1).value = "Proceso";
  headerSC.getCell(1).font = { bold: true };
  headerSC.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  periodos.forEach((per, i) => {
    const cell = headerSC.getCell(i + 2);
    cell.value = fmtPeriodo(per);
    cell.font = { bold: true };
    cell.alignment = { horizontal: "right" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  let scIdx = 3;
  for (const pid of filas) {
    const meta = procesoMeta.get(pid)!;
    const dataRow = shSinCons.getRow(scIdx++);
    dataRow.getCell(1).value = `${meta.ord} - ${meta.nombre}`;
    periodos.forEach((per, i) => {
      const v = byProceso.get(pid)?.get(per);
      const cell = dataRow.getCell(i + 2);
      const isFixed = fixedKeys.has(`${pid}|${per}`);
      cell.value = v != null ? v : null;
      cell.numFmt = "#,##0";
      cell.alignment = { horizontal: "right" };
      if (isFixed) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F5F9" } };
        cell.font = { bold: true, color: { argb: "FF0098BA" } };
        cell.note = "Precio fijo (override) — no cascadea";
      }
    });
  }
  shSinCons.getColumn(1).width = 34;
  periodos.forEach((_, i) => { shSinCons.getColumn(i + 2).width = 14; });

  // ─── Hoja 14: Comparativo (Gráficas) ────────────────────────────────────────
  // Bridge proceso×concepto entre la versión actual y otra versión (compare).
  // Por defecto, usa la versión más reciente con run exitoso distinta a la actual.
  let compareId: string | null = compareIdParam;
  if (!compareId) {
    const { data: candidatas } = await supabase
      .from("budget_versions")
      .select("id, nombre, creado_en")
      .neq("id", versionId)
      .order("creado_en", { ascending: false })
      .limit(20);
    for (const c of (candidatas ?? []) as Array<{ id: string }>) {
      const { data: r } = await supabase
        .from("calculation_runs")
        .select("id")
        .eq("version_id", c.id)
        .eq("estado", "exitoso")
        .limit(1)
        .maybeSingle();
      if (r?.id) { compareId = c.id; break; }
    }
  }

  const shGraf = wb.addWorksheet("Gráficas");
  shGraf.getColumn(1).width = 28;
  shGraf.getColumn(2).width = 16;
  shGraf.getColumn(3).width = 16;
  shGraf.getColumn(4).width = 16;

  if (!compareId) {
    shGraf.getRow(1).getCell(1).value =
      "No se encontró otra versión con run exitoso para comparar. Pasa ?compare=<versionId> al exportar.";
    shGraf.getRow(1).getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
  } else {
    const { data: compVersion } = await supabase
      .from("budget_versions")
      .select("nombre")
      .eq("id", compareId)
      .maybeSingle();

    shGraf.getRow(1).getCell(1).value = `Base: ${version.nombre}    →    Comp: ${compVersion?.nombre ?? compareId}`;
    shGraf.getRow(1).getCell(1).font = { bold: true, size: 12 };

    const productos: Array<{ key: string; ord: number; titulo: string }> = [
      { key: "clinker",     ord: 5,  titulo: "Clínker" },
      { key: "cemento-ug",  ord: 6,  titulo: "Cemento UG" },
      { key: "cemento-art", ord: 7,  titulo: "Cemento ART" },
      { key: "fibrocemento", ord: 16, titulo: "Fibrocemento" },
    ];

    const LOG_TIPOS = [
      "precio_componente_directo",
      "precio_componente_derivado",
      "costo_energia_proceso",
      "costo_componente_derivado_termico",
      "costo_fijo_proceso",
    ] as const;

    const getLastRunIdFor = async (vid: string): Promise<string | null> => {
      const { data } = await supabase
        .from("calculation_runs")
        .select("id")
        .eq("version_id", vid)
        .eq("estado", "exitoso")
        .order("iniciado_en", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    };

    const [baseRunId, compRunId] = await Promise.all([getLastRunIdFor(versionId), getLastRunIdFor(compareId)]);

    let grafRow = 3;
    for (const prod of productos) {
      const { data: proceso } = await supabase
        .from("procesos")
        .select("id, nombre")
        .eq("ord", prod.ord)
        .maybeSingle();

      // Section header
      const hdr = shGraf.getRow(grafRow++);
      hdr.getCell(1).value = `${prod.ord} — ${proceso?.nombre ?? prod.titulo}`;
      hdr.getCell(1).font = { bold: true, size: 11, color: { argb: "FF003865" } };
      hdr.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F5F9" } };
      hdr.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F5F9" } };
      hdr.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F5F9" } };
      hdr.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F5F9" } };

      const colHdr = shGraf.getRow(grafRow++);
      colHdr.getCell(1).value = "Concepto";
      colHdr.getCell(2).value = "Base";
      colHdr.getCell(3).value = "Comparación";
      colHdr.getCell(4).value = "Δ";
      colHdr.font = { bold: true };
      [2, 3, 4].forEach(c => { colHdr.getCell(c).alignment = { horizontal: "right" }; });

      if (!proceso || !baseRunId || !compRunId) {
        const r = shGraf.getRow(grafRow++);
        r.getCell(1).value = "Sin datos suficientes para este producto";
        r.getCell(1).font = { italic: true, color: { argb: "FF9CA3AF" } };
        grafRow++;
        continue;
      }

      const getLogsFor = async (runId: string) => {
        const { data } = await supabase
          .from("calculation_log")
          .select("calculo_tipo, concepto, valor_resultado, material_id")
          .eq("run_id", runId)
          .eq("proceso_id", proceso!.id)
          .in("calculo_tipo", [...LOG_TIPOS]);
        return data ?? [];
      };
      const getPctFor = async (vid: string): Promise<Map<string, number>> => {
        const { data } = await supabase
          .from("recetas")
          .select("periodo, receta_lineas(material_id, porcentaje)")
          .eq("version_id", vid)
          .eq("proceso_id", proceso!.id);
        const map = new Map<string, number>();
        for (const rec of data ?? []) {
          for (const ln of (rec as any).receta_lineas ?? []) {
            map.set(ln.material_id as string, Number(ln.porcentaje));
          }
        }
        return map;
      };

      const [baseLogs, compLogs, basePct, compPct] = await Promise.all([
        getLogsFor(baseRunId),
        getLogsFor(compRunId),
        getPctFor(versionId),
        getPctFor(compareId),
      ]);

      // Resolve material names
      const matIds = Array.from(new Set([...baseLogs, ...compLogs].map(l => l.material_id).filter(Boolean))) as string[];
      const { data: matsGraf } = matIds.length > 0
        ? await supabase.from("materiales").select("id, nombre").in("id", matIds)
        : { data: [] };
      const matNombreGraf = new Map<string, string>();
      for (const m of matsGraf ?? []) matNombreGraf.set(m.id, m.nombre);

      const costoLog = (log: any, pctMap: Map<string, number>): number => {
        if (log.calculo_tipo === "precio_componente_directo" || log.calculo_tipo === "precio_componente_derivado") {
          const pct = log.material_id ? (pctMap.get(log.material_id) ?? 0) : 0;
          return Number(log.valor_resultado) * pct;
        }
        return Number(log.valor_resultado);
      };
      const labelLog = (log: any): string => {
        if (log.material_id && matNombreGraf.has(log.material_id)) return matNombreGraf.get(log.material_id)!;
        if (log.calculo_tipo === "costo_energia_proceso") return "Energía Eléctrica";
        return String(log.concepto ?? log.calculo_tipo);
      };

      const baseMapG = new Map<string, number>();
      for (const l of baseLogs) {
        const k = labelLog(l);
        baseMapG.set(k, (baseMapG.get(k) ?? 0) + costoLog(l, basePct));
      }
      const compMapG = new Map<string, number>();
      for (const l of compLogs) {
        const k = labelLog(l);
        compMapG.set(k, (compMapG.get(k) ?? 0) + costoLog(l, compPct));
      }

      const allKeys = Array.from(new Set([...Array.from(baseMapG.keys()), ...Array.from(compMapG.keys())]))
        .sort((a, b) => Math.abs((compMapG.get(b) ?? 0) - (baseMapG.get(b) ?? 0)) - Math.abs((compMapG.get(a) ?? 0) - (baseMapG.get(a) ?? 0)));

      let totalBase = 0, totalComp = 0;
      for (const k of allKeys) {
        const b = baseMapG.get(k) ?? 0;
        const c = compMapG.get(k) ?? 0;
        totalBase += b; totalComp += c;
        const r = shGraf.getRow(grafRow++);
        r.getCell(1).value = k;
        r.getCell(2).value = b || null;
        r.getCell(2).numFmt = "#,##0"; r.getCell(2).alignment = { horizontal: "right" };
        r.getCell(3).value = c || null;
        r.getCell(3).numFmt = "#,##0"; r.getCell(3).alignment = { horizontal: "right" };
        r.getCell(4).value = (c - b) || null;
        r.getCell(4).numFmt = "#,##0;[Red]-#,##0";
        r.getCell(4).alignment = { horizontal: "right" };
      }

      // Total row
      const totalR = shGraf.getRow(grafRow++);
      totalR.getCell(1).value = "TOTAL";
      totalR.getCell(1).font = { bold: true };
      totalR.getCell(2).value = totalBase || null;
      totalR.getCell(2).numFmt = "#,##0";
      totalR.getCell(2).alignment = { horizontal: "right" };
      totalR.getCell(2).font = { bold: true };
      totalR.getCell(3).value = totalComp || null;
      totalR.getCell(3).numFmt = "#,##0";
      totalR.getCell(3).alignment = { horizontal: "right" };
      totalR.getCell(3).font = { bold: true };
      totalR.getCell(4).value = (totalComp - totalBase) || null;
      totalR.getCell(4).numFmt = "#,##0;[Red]-#,##0";
      totalR.getCell(4).alignment = { horizontal: "right" };
      totalR.getCell(4).font = { bold: true };
      [1, 2, 3, 4].forEach(c => {
        totalR.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FB" } };
      });

      grafRow++; // blank row separator
    }
  }

  // Serialize to buffer
  const buffer = await wb.xlsx.writeBuffer();

  const fileName = `presupuesto_${version.nombre.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
