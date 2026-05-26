import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const url = req.nextUrl;
  const page   = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(200, Number(url.searchParams.get("limit") ?? "100"));
  const offset = (page - 1) * limit;

  const tipo    = url.searchParams.get("tipo");      // entrada|traslado
  const periodo = url.searchParams.get("periodo");   // 2025-09-01
  const ord     = url.searchParams.get("ord");       // "5"

  // Usar la vista v_movimientos_base para tener denominaciones resueltas
  let query = supabase
    .from("v_movimientos_base")
    .select("*", { count: "exact" })
    .eq("version_id", versionId)
    .order("periodo", { ascending: true })
    .order("ord", { ascending: true })
    .range(offset, offset + limit - 1);

  if (tipo)    query = query.eq("tipo_movimiento", tipo);
  if (periodo) query = query.eq("periodo", periodo);
  if (ord)     query = query.eq("ord", Number(ord));

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit });
}
