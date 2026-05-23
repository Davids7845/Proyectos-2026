// GET  → lista recetas con líneas de la versión
// PUT  → reemplaza las líneas de una (proceso_id, periodo) en la versión

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const LineaSchema = z.object({
  material_id: z.string().uuid(),
  porcentaje:  z.number().finite().positive(),
  orden:       z.number().int().positive(),
});

const PutSchema = z.object({
  proceso_id:  z.string().uuid(),
  producto_id: z.string().uuid(),
  periodo:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineas:      z.array(LineaSchema).min(1),
});

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: recetas, error } = await supabase
    .from("recetas")
    .select("id, proceso_id, producto_id, periodo, receta_lineas(material_id, porcentaje, orden)")
    .eq("version_id", versionId)
    .order("periodo");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(recetas ?? []);
}

// ─── PUT ─────────────────────────────────────────────────────────────────────
// Reemplaza la receta completa de (proceso_id, periodo). Crea si no existe.
export async function PUT(
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
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }
  const { proceso_id, producto_id, periodo, lineas } = parsed.data;

  // Upsert receta
  const { data: existing } = await supabase
    .from("recetas")
    .select("id")
    .eq("version_id", versionId)
    .eq("proceso_id", proceso_id)
    .eq("periodo", periodo)
    .maybeSingle();

  let recetaId: string;
  if (existing) {
    recetaId = existing.id;
    // Borrar líneas anteriores
    const { error: delErr } = await supabase
      .from("receta_lineas")
      .delete()
      .eq("receta_id", recetaId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("recetas")
      .insert({ version_id: versionId, proceso_id, producto_id, periodo })
      .select("id")
      .single();
    if (insErr || !inserted) return NextResponse.json({ error: insErr?.message ?? "insert fallido" }, { status: 500 });
    recetaId = inserted.id;
  }

  // Insertar nuevas líneas
  const { error: linesErr } = await supabase
    .from("receta_lineas")
    .insert(lineas.map(l => ({
      receta_id: recetaId,
      material_id: l.material_id,
      porcentaje: l.porcentaje,
      orden: l.orden,
    })));

  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, receta_id: recetaId });
}
