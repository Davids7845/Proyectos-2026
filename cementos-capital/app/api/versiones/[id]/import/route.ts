import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseExcel } from "@/lib/import/excel-importer";
import { loadParsedExcel } from "@/lib/import/excel-loader";

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

  const { data: version, error: verErr } = await supabase
    .from("budget_versions")
    .select("id, estado")
    .eq("id", versionId)
    .single();
  if (verErr || !version) {
    return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });
  }
  if (version.estado !== "borrador") {
    return NextResponse.json(
      { error: `no se puede importar en versión con estado "${version.estado}"` },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "falta archivo (campo 'file')" }, { status: 400 });
  }
  const ab = await file.arrayBuffer();

  let parsed;
  try {
    parsed = parseExcel(ab);
  } catch (e: any) {
    return NextResponse.json({ error: `parse: ${e?.message ?? e}` }, { status: 422 });
  }

  if (parsed.errors.length > 0 && parsed.precios.length === 0) {
    return NextResponse.json({ parsed, report: null }, { status: 422 });
  }

  let report;
  try {
    report = await loadParsedExcel(supabase, versionId, parsed);
  } catch (e: any) {
    return NextResponse.json(
      { error: `load: ${e?.message ?? e}`, parsed },
      { status: 500 }
    );
  }

  return NextResponse.json({ parsed: { periodos: parsed.periodos, warnings: parsed.warnings, errors: parsed.errors }, report });
}
