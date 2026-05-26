// Motor efímero para análisis de sensibilidad — Fase 2b Módulo 2.
// Carga el contexto de una versión, aplica overrides de precios y vuelve a
// ejecutar todos los procesos con InMemoryWriter (sin tocar la BD).

import { CALCULADORES, ensureFormulas, loadContext } from "@/lib/calc/engine/runner";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, Client, Periodo, UUID } from "@/lib/calc/engine/context";

export interface SensibilidadOverride {
  tipo: "precio_material";
  material_codigo: string;
  factor: number; // 1.10 = +10%
}

export interface ProcesoCostoResult {
  proceso_id: UUID;
  ord: number;
  nombre: string;
  periodo: Periodo;
  costo_total: number;
  costo_por_ton: number;
}

export interface SensibilidadResult {
  base: ProcesoCostoResult[];
  sensitized: ProcesoCostoResult[];
  deltas: Array<{
    proceso_id: UUID;
    ord: number;
    nombre: string;
    periodo: Periodo;
    base_cop_ton: number;
    sens_cop_ton: number;
    delta_abs: number;
    delta_pct: number;
  }>;
  applied_overrides: SensibilidadOverride[];
  skipped: Array<{ ord: number; periodo: Periodo; reason: string }>;
}

function applyOverrides(ctx: CalcContext, overrides: SensibilidadOverride[]): SensibilidadOverride[] {
  const applied: SensibilidadOverride[] = [];
  for (const ov of overrides) {
    if (ov.tipo !== "precio_material") continue;
    if (!isFinite(ov.factor) || ov.factor <= 0) continue;
    const mat = ctx.materialesByCodigo.get(ov.material_codigo);
    if (!mat) continue;

    let touched = 0;
    for (const [key, p] of Array.from(ctx.preciosByMatPeriodo.entries())) {
      if (p.material_id === mat.id) {
        ctx.preciosByMatPeriodo.set(key, { ...p, precio: p.precio * ov.factor });
        touched++;
      }
    }
    // También overrides de precio_mp directos por proceso (Fase 1.7)
    if (ctx.precioMpOverrideByKey) {
      for (const [key, val] of Array.from(ctx.precioMpOverrideByKey.entries())) {
        // key: `${proceso_id}|${material_codigo}|${periodo}`
        if (key.split("|")[1] === ov.material_codigo) {
          ctx.precioMpOverrideByKey.set(key, val * ov.factor);
          touched++;
        }
      }
    }
    if (touched > 0) applied.push(ov);
  }
  return applied;
}

async function runAllProcesos(ctx: CalcContext): Promise<{
  results: ProcesoCostoResult[];
  skipped: Array<{ ord: number; periodo: Periodo; reason: string }>;
}> {
  const writer = new InMemoryWriter();
  const procesos = ctx.procesos
    .filter(p => CALCULADORES[p.ord] !== undefined)
    .sort((a, b) => a.orden_topologico - b.orden_topologico);

  const results: ProcesoCostoResult[] = [];
  const skipped: Array<{ ord: number; periodo: Periodo; reason: string }> = [];

  for (const proc of procesos) {
    const calc = CALCULADORES[proc.ord];
    for (const periodo of ctx.periodos) {
      try {
        const r = await calc.run({ ctx, proceso: proc, periodo, writer });
        ctx.costoProcesoByKey.set(`${proc.id}|${periodo}`, {
          costo_total: r.costo_total,
          costo_por_ton: r.costo_por_ton,
          calc_total_id: r.calc_total_id,
        });
        results.push({
          proceso_id: proc.id,
          ord: proc.ord,
          nombre: proc.nombre,
          periodo,
          costo_total: r.costo_total,
          costo_por_ton: r.costo_por_ton,
        });
      } catch (e) {
        skipped.push({ ord: proc.ord, periodo, reason: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return { results, skipped };
}

export async function runSensibilidad(
  supabase: Client,
  versionId: UUID,
  overrides: SensibilidadOverride[],
): Promise<SensibilidadResult> {
  // 1) Sembrar fórmulas (idempotente) y obtener mapa codigo→id
  const formulaIdByCodigo = await ensureFormulas(supabase);

  // 2) Cargar contexto base
  const baseCtx = await loadContext(supabase, versionId, "ephemeral-base", formulaIdByCodigo);
  // Reset costoProcesoByKey para empezar limpio (loadContext devuelve Map vacío pero por si acaso)
  baseCtx.costoProcesoByKey = new Map();

  // 3) Ejecutar base (sin overrides)
  const base = await runAllProcesos(baseCtx);

  // 4) Cargar contexto sensibilizado (otra instancia para no contaminar)
  const sensCtx = await loadContext(supabase, versionId, "ephemeral-sens", formulaIdByCodigo);
  sensCtx.costoProcesoByKey = new Map();

  // 5) Aplicar overrides
  const applied = applyOverrides(sensCtx, overrides);

  // 6) Ejecutar sensibilizado
  const sens = await runAllProcesos(sensCtx);

  // 7) Calcular deltas
  const baseByKey = new Map<string, ProcesoCostoResult>();
  for (const r of base.results) baseByKey.set(`${r.proceso_id}|${r.periodo}`, r);

  const deltas: SensibilidadResult["deltas"] = [];
  for (const s of sens.results) {
    const b = baseByKey.get(`${s.proceso_id}|${s.periodo}`);
    if (!b) continue;
    const delta_abs = s.costo_por_ton - b.costo_por_ton;
    const delta_pct = b.costo_por_ton > 0 ? delta_abs / b.costo_por_ton : 0;
    deltas.push({
      proceso_id: s.proceso_id,
      ord:        s.ord,
      nombre:     s.nombre,
      periodo:    s.periodo,
      base_cop_ton: b.costo_por_ton,
      sens_cop_ton: s.costo_por_ton,
      delta_abs,
      delta_pct,
    });
  }

  return {
    base: base.results,
    sensitized: sens.results,
    deltas,
    applied_overrides: applied,
    skipped: [...base.skipped, ...sens.skipped],
  };
}
