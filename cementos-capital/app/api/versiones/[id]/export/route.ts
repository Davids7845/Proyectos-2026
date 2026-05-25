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
    { data: _procesos }, // eslint-disable-line @typescript-eslint/no-unused-vars
  ] = await Promise.all([
    supabase
      .from("costo_proceso")
      .select("periodo, costo_por_ton, costo_total, costo_materia_prima, costo_energia, costo_combustible, proceso:procesos(id, ord, nombre, orden_topologico)")
      .eq("run_id", lastRun.id),
    supabase
      .from("precios_insumos")
      .select("periodo, precio_cop, material:materiales(codigo, nombre)")
      .eq("version_id", versionId)
      .order("periodo"),
    supabase
      .from("procesos")
      .select("id, ord, nombre, orden_topologico")
      .eq("activo", true)
      .order("orden_topologico"),
  ]);

  const rows = (costoRows ?? []) as Array<{
    periodo: string;
    costo_por_ton: number;
    costo_total: number;
    costo_materia_prima: number | null;
    costo_energia: number | null;
    costo_combustible: number | null;
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
