// Endpoint de diagnóstico temporal — dump del contenido importado de una versión.
// Devuelve material codes para pct/precios de CALTLVTRIT y conteos para verificar
// que el loader Excel insertó los casos especiales (caliza/martillo).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  // Buscar material_id de CALTLVTRIT y ARCTLVTRIT
  const { data: mats } = await supabase
    .from("materiales")
    .select("id, codigo")
    .in("codigo", ["CALTLVTRIT", "ARCTLVTRIT"]);
  const byCodigo: Record<string, string> = {};
  for (const m of mats ?? []) byCodigo[m.codigo] = m.id;

  const caltlvtritId = byCodigo["CALTLVTRIT"];

  // precios de CALTLVTRIT en esta versión
  const { data: preciosCal } = await supabase
    .from("precios_insumos")
    .select("periodo, proveedor, precio_unitario")
    .eq("version_id", versionId)
    .eq("material_id", caltlvtritId ?? "")
    .order("periodo");

  // pct consumo de CALTLVTRIT en esta versión
  const { data: pctCal } = await supabase
    .from("porcentajes_consumo")
    .select("periodo, proveedor, porcentaje")
    .eq("version_id", versionId)
    .eq("material_id", caltlvtritId ?? "")
    .order("periodo");

  // recetas para esta versión con proceso + producto + #lineas
  const { data: recetas } = await supabase
    .from("recetas")
    .select("id, periodo, producto:materiales(codigo), proceso:procesos(ord, nombre), receta_lineas(count)")
    .eq("version_id", versionId)
    .order("periodo");

  return NextResponse.json({
    versionId,
    caltlvtritId,
    precios_caltlvtrit: preciosCal,
    pct_caltlvtrit: pctCal,
    recetas: (recetas ?? []).map((r: any) => ({
      id: r.id,
      periodo: r.periodo,
      proceso_ord: r.proceso?.ord,
      proceso_nombre: r.proceso?.nombre,
      producto_codigo: r.producto?.codigo,
      num_lineas: r.receta_lineas?.[0]?.count ?? 0,
    })),
  });
}
