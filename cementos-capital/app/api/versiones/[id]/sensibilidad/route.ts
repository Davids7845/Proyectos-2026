import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runSensibilidad } from "@/lib/sensibilidad/run";

export const runtime = "nodejs";
// Sensibilidad puede tomar varios segundos (corre el motor 2x). Vercel hobby
// permite 60s; bumpeamos por si acaso.
export const maxDuration = 60;

const OverrideSchema = z.object({
  tipo: z.literal("precio_material"),
  material_codigo: z.string().min(1),
  factor: z.number().finite().positive(),
});
const BodySchema = z.object({
  overrides: z.array(OverrideSchema).max(50),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("; ") }, { status: 400 });
  }

  try {
    const result = await runSensibilidad(supabase, versionId, parsed.data.overrides);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
