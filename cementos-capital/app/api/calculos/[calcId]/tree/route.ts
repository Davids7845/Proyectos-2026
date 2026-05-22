import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CalcNode {
  id: string;
  calculo_tipo: string;
  concepto: string;
  valor_resultado: number;
  unidad: string | null;
  formula_codigo: string;
  formula_nombre: string;
  formula_expresion: string;
  parametros_entrada: unknown;
  nivel_jerarquia: number;
  hijos: Array<{ rol: string | null; nodo: CalcNode }>;
  es_override: boolean;
  motivo_override: string | null;
  valor_original: number | null;
}

/**
 * Retorna el árbol completo del cálculo (descendiendo por calculation_log_deps).
 * Hace BFS por nivel para minimizar round-trips a la BD.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ calcId: string }> }
) {
  const { calcId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const visited = new Map<string, CalcNode>();
  const queue: string[] = [calcId];
  const childrenByParent = new Map<string, Array<{ rol: string | null; childId: string }>>();

  while (queue.length > 0) {
    const batch = Array.from(new Set(queue.splice(0, 50)));
    const pendientes = batch.filter(id => !visited.has(id));
    if (pendientes.length === 0) continue;

    const { data: logs, error } = await supabase
      .from("calculation_log")
      .select(`
        id, calculo_tipo, concepto, valor_resultado, unidad,
        formula_expresion, parametros_entrada, nivel_jerarquia,
        es_override, motivo_override, valor_original,
        formula:formula_definitions(codigo, nombre)
      `)
      .in("id", pendientes);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const l of logs ?? []) {
      const formula = Array.isArray(l.formula) ? l.formula[0] : l.formula;
      visited.set(l.id, {
        id: l.id,
        calculo_tipo: l.calculo_tipo,
        concepto: l.concepto,
        valor_resultado: Number(l.valor_resultado),
        unidad: l.unidad,
        formula_codigo: formula?.codigo ?? "?",
        formula_nombre: formula?.nombre ?? "?",
        formula_expresion: l.formula_expresion,
        parametros_entrada: l.parametros_entrada,
        nivel_jerarquia: l.nivel_jerarquia,
        es_override: l.es_override,
        motivo_override: l.motivo_override,
        valor_original: l.valor_original != null ? Number(l.valor_original) : null,
        hijos: [],
      });
    }

    const { data: deps, error: depErr } = await supabase
      .from("calculation_log_deps")
      .select("calculo_id, depende_de_id, rol_parametro")
      .in("calculo_id", pendientes);
    if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 });

    for (const d of deps ?? []) {
      const arr = childrenByParent.get(d.calculo_id) ?? [];
      arr.push({ rol: d.rol_parametro, childId: d.depende_de_id });
      childrenByParent.set(d.calculo_id, arr);
      if (!visited.has(d.depende_de_id)) queue.push(d.depende_de_id);
    }
  }

  // Ensamblar el árbol
  for (const [parentId, children] of Array.from(childrenByParent.entries())) {
    const parent = visited.get(parentId);
    if (!parent) continue;
    for (const c of children) {
      const child = visited.get(c.childId);
      if (child) parent.hijos.push({ rol: c.rol, nodo: child });
    }
  }

  const root = visited.get(calcId);
  if (!root) return NextResponse.json({ error: "cálculo no encontrado" }, { status: 404 });
  return NextResponse.json({ root });
}
