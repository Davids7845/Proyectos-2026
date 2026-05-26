// POST /api/versiones/[id]/costos-reales/from-calc
// Body JSON: { runId: uuid, periodo?: "YYYY-MM" }
// Copia los movimientos de un run del motor a costos_reales como
// origen='calc' (datos reales calculados, no importados de Excel).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { copyCalcToReales } from "@/lib/sap/copy-calc-to-reales";

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
    .select("id")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });

  let body: { runId?: string; periodo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.runId) {
    return NextResponse.json({ error: "falta runId" }, { status: 400 });
  }
  const periodo = body.periodo
    ? (/^\d{4}-\d{2}$/.test(body.periodo) ? `${body.periodo}-01` : body.periodo)
    : undefined;

  const report = await copyCalcToReales(supabase, {
    versionId,
    runId: body.runId,
    periodo,
  });

  return NextResponse.json({ report });
}
