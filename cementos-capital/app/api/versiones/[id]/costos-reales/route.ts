// POST /api/versiones/[id]/costos-reales
// Recibe un Excel (FormData campo "file") y un período "periodo" (YYYY-MM)
// y carga los costos reales del panel configurado de la hoja "Costo".
//
// Query params opcionales:
//   colConsumo / colPrecio / colTotal  → columns del panel (default N/O/P)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCostosReales } from "@/lib/import/costos-reales-parser";
import { loadCostosReales } from "@/lib/import/costos-reales-loader";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });

  const form = await req.formData();
  const file    = form.get("file");
  const periodoRaw = form.get("periodo") as string | null;

  if (!(file instanceof File))
    return NextResponse.json({ error: "falta campo 'file'" }, { status: 400 });
  if (!periodoRaw || !/^\d{4}-\d{2}$/.test(periodoRaw))
    return NextResponse.json(
      { error: "falta campo 'periodo' en formato YYYY-MM" },
      { status: 400 }
    );

  // Convertir YYYY-MM → primer día del mes (consistente con BD)
  const periodo = `${periodoRaw}-01`;

  const sp = req.nextUrl.searchParams;
  const parseOpts = {
    colConsumo: sp.get("colConsumo") ?? undefined,
    colPrecio:  sp.get("colPrecio")  ?? undefined,
    colTotal:   sp.get("colTotal")   ?? undefined,
  };

  const buffer = Buffer.from(await file.arrayBuffer());

  let parseResult;
  try {
    parseResult = parseCostosReales(buffer, parseOpts);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `parse: ${msg}` }, { status: 422 });
  }

  const report = await loadCostosReales(
    supabase, versionId, periodo, parseResult.filas
  );

  return NextResponse.json({
    periodo,
    filas_parseadas: parseResult.filas.length,
    warnings_parser: parseResult.warnings,
    report,
  });
}
