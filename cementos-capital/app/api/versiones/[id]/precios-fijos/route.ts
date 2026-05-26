import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const RowSchema = z.object({
  proceso_id:     z.string().uuid(),
  periodo:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  precio_cop_ton: z.number().finite().nonnegative().nullable(),
});
const BodySchema = z.object({ rows: z.array(RowSchema) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, estado, precios_fijos")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "versión no encontrada" }, { status: 404 });
  if (version.estado !== "borrador") {
    return NextResponse.json({ error: `estado ${version.estado} no editable` }, { status: 400 });
  }
  if (!(version as { precios_fijos?: boolean }).precios_fijos) {
    return NextResponse.json({ error: "versión no está en modo Sin Consolidar" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }

  const sb = supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }> };
      upsert: (rows: unknown, opts?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
    };
  };

  // Split en filas a eliminar (null) y filas a upsert
  const toDelete = parsed.data.rows
    .filter(r => r.precio_cop_ton == null)
    .map(r => ({ proceso_id: r.proceso_id, periodo: r.periodo }));
  const toUpsert = parsed.data.rows
    .filter(r => r.precio_cop_ton != null)
    .map(r => ({
      version_id: versionId,
      proceso_id: r.proceso_id,
      periodo:    r.periodo,
      precio_cop_ton: r.precio_cop_ton,
    }));

  // Borrado: filas explícitamente puestas a null por el usuario
  // (idempotente; si no hay nada para borrar, no-op).
  for (const d of toDelete) {
    const builder = (supabase as unknown as {
      from: (t: string) => { delete: () => {
        eq: (col: string, val: unknown) => {
          eq: (col: string, val: unknown) => {
            eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>;
          };
        };
      } };
    }).from("precios_fijos_overrides");
    const { error: delErr } = await builder
      .delete()
      .eq("version_id", versionId)
      .eq("proceso_id", d.proceso_id)
      .eq("periodo",    d.periodo);
    if (delErr) return NextResponse.json({ error: `delete: ${delErr.message}` }, { status: 500 });
  }

  if (toUpsert.length > 0) {
    const { error: upErr } = await sb.from("precios_fijos_overrides").upsert(toUpsert, {
      onConflict: "version_id,proceso_id,periodo",
    });
    if (upErr) return NextResponse.json({ error: `upsert: ${upErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: toDelete.length, upserted: toUpsert.length });
}
