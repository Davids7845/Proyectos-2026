import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCalculation } from "@/lib/calc/engine/runner";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
    .select("id, estado")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });
  if (version.estado === "congelado" || version.estado === "archivado") {
    return NextResponse.json({ error: `estado ${version.estado} no permite calcular` }, { status: 400 });
  }

  // Marcar versión como calculando
  await supabase.from("budget_versions").update({ estado: "calculando" }).eq("id", versionId);

  const summary = await runCalculation(supabase, {
    versionId,
    iniciado_por: user.id,
  });

  await supabase
    .from("budget_versions")
    .update({ estado: summary.estado === "exitoso" ? "calculado" : "borrador" })
    .eq("id", versionId);

  return NextResponse.json(summary);
}
