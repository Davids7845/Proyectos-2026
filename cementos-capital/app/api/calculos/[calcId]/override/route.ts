import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyOverride, clearOverride } from "@/lib/calc/engine/override";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const PatchSchema = z.object({
  nuevo_valor: z.number().finite(),
  motivo: z.string().min(1).max(500),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ calcId: string }> }
) {
  const { calcId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  // Verificar que la versión asociada está editable
  const { data: calc } = await supabase
    .from("calculation_log")
    .select("version_id")
    .eq("id", calcId)
    .single();
  if (!calc) return NextResponse.json({ error: "cálculo no encontrado" }, { status: 404 });

  const { data: ver } = await supabase
    .from("budget_versions")
    .select("estado")
    .eq("id", calc.version_id)
    .single();
  if (ver?.estado === "congelado" || ver?.estado === "archivado") {
    return NextResponse.json({ error: `estado ${ver.estado} no permite override` }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }

  try {
    const result = await applyOverride(supabase, calcId, parsed.data.nuevo_valor, parsed.data.motivo);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ calcId: string }> }
) {
  const { calcId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: calc } = await supabase
    .from("calculation_log")
    .select("version_id")
    .eq("id", calcId)
    .single();
  if (!calc) return NextResponse.json({ error: "cálculo no encontrado" }, { status: 404 });

  const { data: ver } = await supabase
    .from("budget_versions")
    .select("estado")
    .eq("id", calc.version_id)
    .single();
  if (ver?.estado === "congelado" || ver?.estado === "archivado") {
    return NextResponse.json({ error: `estado ${ver.estado} no permite restaurar` }, { status: 400 });
  }

  try {
    const result = await clearOverride(supabase, calcId);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
