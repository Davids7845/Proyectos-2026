import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularPeriodoDB } from "@/lib/calc/motor/orquestador";
import { contarPeriodos } from "@/lib/calc/motor/periodos";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/versiones/[id]/recalcular-motor
 * Ejecuta el motor de fórmulas NUEVO (lib/calc/motor) para todos los períodos
 * de la versión y persiste en costo_calculado + movimientos_generados.
 *
 * NO destructivo: las tablas/calculadoras viejas no se tocan. Endpoint temporal
 * de R6a para alimentar la UI con `?motor=nuevo` y comparar lado a lado.
 */
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
    .select("id, fecha_inicio, fecha_fin")
    .eq("id", versionId)
    .single();
  if (!version) return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
  if (!version.fecha_inicio || !version.fecha_fin) {
    return NextResponse.json({ error: "La versión no tiene rango de fechas" }, { status: 400 });
  }

  const numPeriodos = contarPeriodos(version.fecha_inicio, version.fecha_fin);

  // Limpiar cálculos previos del motor nuevo (idempotente).
  // (tablas del motor nuevo aún no presentes en los tipos generados → cast a any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("costo_calculado").delete().eq("version_id", versionId);
  await sb.from("movimientos_generados").delete().eq("version_id", versionId);

  const detalle: Array<{ periodo: number; procesos_calculados: number }> = [];
  for (let periodo = 1; periodo <= numPeriodos; periodo++) {
    const res = await calcularPeriodoDB(sb, versionId, periodo);
    detalle.push({ periodo, procesos_calculados: res.length });
  }

  return NextResponse.json({
    ok: true,
    version_id: versionId,
    periodos_calculados: numPeriodos,
    detalle,
  });
}
