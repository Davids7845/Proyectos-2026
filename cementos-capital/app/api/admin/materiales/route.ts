import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const PostSchema = z.object({
  codigo:      z.string().min(1).max(20).regex(/^[A-Z0-9_]+$/, "Solo mayúsculas, números y guión bajo"),
  nombre:      z.string().min(1).max(200),
  unidad_base: z.string().min(1).max(20),
  categoria:   z.string().max(50).optional().nullable(),
  tipo_insumo: z.string().max(50).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }

  const { error, data } = await supabase
    .from("materiales")
    .insert({ ...parsed.data, activo: true })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: `El código ${parsed.data.codigo} ya existe` }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id });
}
