// GET  /api/materiales-agregados          → lista todos agrupados por material destino
// POST /api/materiales-agregados          → agregar nuevo componente a un agregado
//
// material_agregados: material_destino_id + material_origen_id + porcentaje (0-1) + orden

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("material_agregados")
    .select(`
      id,
      porcentaje,
      orden,
      notas,
      material_destino:materiales!material_destino_id(id, codigo, nombre),
      material_origen:materiales!material_origen_id(id, codigo, nombre)
    `)
    .order("orden");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by material_destino_id
  const byDestino = new Map<string, {
    material_destino: { id: string; codigo: string; nombre: string };
    componentes: Array<{
      id: string;
      porcentaje: number;
      orden: number;
      notas: string | null;
      material_origen: { id: string; codigo: string; nombre: string };
    }>;
    suma_porcentajes: number;
  }>();

  for (const row of (data ?? []) as Array<{
    id: string;
    porcentaje: number;
    orden: number;
    notas: string | null;
    material_destino: { id: string; codigo: string; nombre: string };
    material_origen: { id: string; codigo: string; nombre: string };
  }>) {
    const did = row.material_destino.id;
    if (!byDestino.has(did)) {
      byDestino.set(did, {
        material_destino: row.material_destino,
        componentes: [],
        suma_porcentajes: 0,
      });
    }
    const group = byDestino.get(did)!;
    group.componentes.push({
      id: row.id,
      porcentaje: Number(row.porcentaje),
      orden: row.orden,
      notas: row.notas,
      material_origen: row.material_origen,
    });
    group.suma_porcentajes += Number(row.porcentaje);
  }

  return NextResponse.json({
    agregados: Array.from(byDestino.values()).sort((a, b) =>
      a.material_destino.nombre.localeCompare(b.material_destino.nombre)
    ),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const body = await req.json() as {
    material_destino_id: string;
    material_origen_id: string;
    porcentaje: number;
    orden?: number;
    notas?: string;
  };

  if (!body.material_destino_id || !body.material_origen_id) {
    return NextResponse.json({ error: "material_destino_id y material_origen_id son requeridos" }, { status: 400 });
  }
  if (body.material_destino_id === body.material_origen_id) {
    return NextResponse.json({ error: "El material origen y destino no pueden ser el mismo" }, { status: 400 });
  }
  if (typeof body.porcentaje !== "number" || body.porcentaje < 0 || body.porcentaje > 1) {
    return NextResponse.json({ error: "porcentaje debe estar entre 0 y 1" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("material_agregados")
    .insert({
      material_destino_id: body.material_destino_id,
      material_origen_id: body.material_origen_id,
      porcentaje: body.porcentaje,
      orden: body.orden ?? 0,
      notas: body.notas ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Este material origen ya está en la composición" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
