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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado")
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

  // ─── Hoja 11: Energía ───────────────────────────────────────────────────────
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
