import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/versiones/[id]/ponderado?desde=2026-01-01&hasta=2026-12-01
//
// Costo ponderado por proceso a partir de plan_movimientos, según el filtro de
// período. Fórmula base (Regla 1):
//   costo_por_ton = SUMA(valor) / SUMA(producción)   sobre los meses del filtro
// Si `desde`/`hasta` se omiten, usa todos los meses disponibles (promedio anual).

interface MovRow {
  proceso_id: string;
  periodo: string;
  tipo: "mp" | "energia" | "fijo";
  codigo: string;
  nombre: string;
  produccion_ton: number;
  cantidad: number;
  valor: number;
}

interface ComponenteOut {
  tipo: string;
  codigo: string;
  nombre: string;
  consumo: number;         // SUMA(cantidad) / SUMA(producción)
  costo_unitario: number;  // SUMA(valor) / SUMA(cantidad)
  aporte: number;          // SUMA(valor) / SUMA(producción)
}

interface ProcesoOut {
  proceso_id: string;
  ord: number;
  nombre: string;
  meses: number;
  produccion: number;
  costo_por_ton: number;       // SUMA(valor) / SUMA(producción)
  componentes: ComponenteOut[];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => any;
    };
  };

  const url = req.nextUrl;
  const desde = url.searchParams.get("desde"); // YYYY-MM-01 | null
  const hasta = url.searchParams.get("hasta"); // YYYY-MM-01 | null

  // Traer todos los movimientos de la versión (paginado por si crece > 1000).
  const PAGE = 1000;
  const movs: MovRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from("plan_movimientos")
      .select("proceso_id, periodo, tipo, codigo, nombre, produccion_ton, cantidad, valor")
      .eq("version_id", versionId);
    if (desde) q = q.gte("periodo", desde);
    if (hasta) q = q.lte("periodo", hasta);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) {
      if (String(error.message).includes("does not exist")) {
        return NextResponse.json({ error: "plan_movimientos no existe (aplica la migración 028)" }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as MovRow[];
    movs.push(...rows.map(r => ({
      ...r,
      produccion_ton: Number(r.produccion_ton),
      cantidad: Number(r.cantidad),
      valor: Number(r.valor),
    })));
    if (rows.length < PAGE) break;
  }

  // Metadata de procesos (ord, nombre).
  const procIds = Array.from(new Set(movs.map(m => m.proceso_id)));
  const procMeta = new Map<string, { ord: number; nombre: string }>();
  if (procIds.length > 0) {
    const { data: procs } = await supabase
      .from("procesos")
      .select("id, ord, nombre")
      .in("id", procIds);
    for (const p of procs ?? []) procMeta.set(p.id, { ord: p.ord, nombre: p.nombre });
  }

  // Períodos disponibles (para poblar el selector de la UI), independiente del filtro.
  const periodosDisponibles = await (async () => {
    const set = new Set<string>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("plan_movimientos")
        .select("periodo")
        .eq("version_id", versionId)
        .range(from, from + PAGE - 1);
      if (error) break;
      const rows = (data ?? []) as Array<{ periodo: string }>;
      for (const r of rows) set.add(r.periodo);
      if (rows.length < PAGE) break;
    }
    return Array.from(set).sort();
  })();

  // Agregación por proceso y por componente.
  // total_prod del proceso = SUMA sobre meses de la producción de ese mes
  // (la producción es la misma para todos los componentes de un mismo mes).
  const byProceso = new Map<string, {
    prodPorPeriodo: Map<string, number>;
    comps: Map<string, { tipo: string; nombre: string; valor: number; cantidad: number }>;
  }>();

  for (const m of movs) {
    let p = byProceso.get(m.proceso_id);
    if (!p) { p = { prodPorPeriodo: new Map(), comps: new Map() }; byProceso.set(m.proceso_id, p); }
    // producción del mes (max porque es constante entre componentes del mes)
    const prev = p.prodPorPeriodo.get(m.periodo) ?? 0;
    if (m.produccion_ton > prev) p.prodPorPeriodo.set(m.periodo, m.produccion_ton);
    const ckey = `${m.tipo}|${m.codigo}`;
    let c = p.comps.get(ckey);
    if (!c) { c = { tipo: m.tipo, nombre: m.nombre, valor: 0, cantidad: 0 }; p.comps.set(ckey, c); }
    c.valor += m.valor;
    c.cantidad += m.cantidad;
  }

  const procesos: ProcesoOut[] = [];
  byProceso.forEach((agg, pid) => {
    let totalProd = 0;
    agg.prodPorPeriodo.forEach(v => { totalProd += v; });
    const meta = procMeta.get(pid) ?? { ord: 99, nombre: "?" };
    const componentes: ComponenteOut[] = [];
    let totalValor = 0;
    agg.comps.forEach((c, ckey) => {
      totalValor += c.valor;
      componentes.push({
        tipo: c.tipo,
        codigo: ckey.split("|")[1],
        nombre: c.nombre,
        consumo: totalProd > 0 ? c.cantidad / totalProd : 0,
        costo_unitario: c.cantidad > 0 ? c.valor / c.cantidad : 0,
        aporte: totalProd > 0 ? c.valor / totalProd : 0,
      });
    });
    componentes.sort((a, b) => b.aporte - a.aporte);
    procesos.push({
      proceso_id: pid,
      ord: meta.ord,
      nombre: meta.nombre,
      meses: agg.prodPorPeriodo.size,
      produccion: totalProd,
      costo_por_ton: totalProd > 0 ? totalValor / totalProd : 0,
      componentes,
    });
  });
  procesos.sort((a, b) => a.ord - b.ord);

  return NextResponse.json({
    version_id: versionId,
    filtro: { desde: desde ?? null, hasta: hasta ?? null },
    periodos_disponibles: periodosDisponibles,
    procesos,
  });
}
