import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const PatchSchema = z.object({
  id: z.string().uuid(),
  precio_unitario: z.number().finite(),
});

export async function PATCH(
  req: NextRequest,
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
  if (version.estado !== "borrador") {
    return NextResponse.json({ error: `estado ${version.estado} no editable` }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }

  const { id, precio_unitario } = parsed.data;

  // Verificar que el precio pertenece a esta versión (defensa en profundidad — RLS también filtra)
  const { data: precio, error: selErr } = await supabase
    .from("precios_insumos")
    .select("id, version_id")
    .eq("id", id)
    .single();
  if (selErr || !precio) return NextResponse.json({ error: "precio no encontrado" }, { status: 404 });
  if (precio.version_id !== versionId) {
    return NextResponse.json({ error: "precio no pertenece a la versión" }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("precios_insumos")
    .update({ precio_unitario: String(precio_unitario) })
    .eq("id", id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
