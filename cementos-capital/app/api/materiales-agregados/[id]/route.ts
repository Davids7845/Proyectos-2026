// PATCH  /api/materiales-agregados/[id]  → cambiar porcentaje (y/o orden, notas)
// DELETE /api/materiales-agregados/[id]  → eliminar componente

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const body = await req.json() as {
    porcentaje?: number;
    orden?: number;
    notas?: string;
  };

  if (body.porcentaje !== undefined && (typeof body.porcentaje !== "number" || body.porcentaje < 0 || body.porcentaje > 1)) {
    return NextResponse.json({ error: "porcentaje debe estar entre 0 y 1" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.porcentaje !== undefined) updates.porcentaje = body.porcentaje;
  if (body.orden !== undefined) updates.orden = body.orden;
  if (body.notas !== undefined) updates.notas = body.notas;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("material_agregados")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("material_agregados")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
