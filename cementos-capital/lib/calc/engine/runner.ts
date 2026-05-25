// Orquestador del cálculo de presupuesto.
// 1) Abre calculation_runs (estado=corriendo)
// 2) Siembra formula_definitions (idempotente)
// 3) Carga contexto (materiales, precios, % consumo, recetas)
// 4) Recorre procesos por orden_topologico × periodos
// 5) Llama al calculador correspondiente, escribe log + costo_proceso
// 6) Cierra calculation_runs (exitoso/error)

import type {
  CalcContext,
  Client,
  MaterialMeta,
  ParametrosEnergiaCtx,
  Periodo,
  PrecioCtx,
  PctConsumoCtx,
  ProcesoCalculator,
  ProcesoMeta,
  RecetaCtx,
  RendimientoCtx,
  UUID,
} from "./context";
import { SupabaseWriter } from "./writer";
import { FORMULA_REGISTRY } from "@/lib/calc/formulas";
import { Ord01Trituracion }    from "@/lib/calc/procesos/ord01_trituracion";
import { Ord02Adiciones }      from "@/lib/calc/procesos/ord02_adiciones";
import { Ord03MoliendaCrudo }  from "@/lib/calc/procesos/ord03_molienda_crudo";
import { Ord04MoliendaCarbon } from "@/lib/calc/procesos/ord04_molienda_carbon";
import { Ord05Clinkerizacion } from "@/lib/calc/procesos/ord05_clinkerizacion";
import { Ord06CementoUg }       from "@/lib/calc/procesos/ord06_cemento_ug";
import { Ord07CementoArt }      from "@/lib/calc/procesos/ord07_cemento_art";
import { Ord08CementoUg50 }     from "@/lib/calc/procesos/ord08_cemento_ug_50";
import { Ord09CementoUg42 }     from "@/lib/calc/procesos/ord09_cemento_ug_42";
import { Ord10CementoUg25 }     from "@/lib/calc/procesos/ord10_cemento_ug_25";
import { Ord11CementoArt42 }    from "@/lib/calc/procesos/ord11_cemento_art_42";
import { Ord14CementoTopex50 }  from "@/lib/calc/procesos/ord14_cemento_topex_50";
import { Ord15CementoUgTp }     from "@/lib/calc/procesos/ord15_cemento_ug_tp";
import { Ord16Fibrocemento }    from "@/lib/calc/procesos/ord16_fibrocemento";
import { Ord19CementoBigBag }          from "@/lib/calc/procesos/ord19_cemento_bigbag";
import { Ord20CombustiblesAlternos }   from "@/lib/calc/procesos/ord20_combustibles_alternos";
import { Ord21Cementos }               from "@/lib/calc/procesos/ord21_cementos";

// Calculadoras registradas por `ord`. Procesos sin entry se omiten (con warning).
const CALCULADORES: Record<number, ProcesoCalculator> = {
   1: new Ord01Trituracion(),
   2: new Ord02Adiciones(),
   3: new Ord03MoliendaCrudo(),
   4: new Ord04MoliendaCarbon(),
   5: new Ord05Clinkerizacion(),
   6: new Ord06CementoUg(),
   7: new Ord07CementoArt(),
   8: new Ord08CementoUg50(),
   9: new Ord09CementoUg42(),
  10: new Ord10CementoUg25(),
  11: new Ord11CementoArt42(),
  14: new Ord14CementoTopex50(),
  15: new Ord15CementoUgTp(),
  16: new Ord16Fibrocemento(),
  19: new Ord19CementoBigBag(),
  20: new Ord20CombustiblesAlternos(),
  21: new Ord21Cementos(),
};

export interface RunOptions {
  versionId: UUID;
  /** Si se omite, calcula todos los periodos detectados en precios_insumos. */
  periodos?: Periodo[];
  /** Si se omite, calcula todos los procesos con calculador registrado. */
  procesosOrd?: number[];
  iniciado_por?: string | null;
}

export interface RunSummary {
  runId: UUID;
  estado: "exitoso" | "error";
  duracion_ms: number;
  total_calculos: number;
  procesos_calculados: number;
  procesos_omitidos: Array<{ ord: number; razon: string }>;
  error_msg: string | null;
}

export async function runCalculation(
  supabase: Client,
  opts: RunOptions
): Promise<RunSummary> {
  const t0 = Date.now();
  const omitidos: RunSummary["procesos_omitidos"] = [];

  // ─── Crear run ──────────────────────────────────────────────────
  const { data: run, error: runErr } = await supabase
    .from("calculation_runs")
    .insert({
      version_id: opts.versionId,
      estado: "corriendo",
      iniciado_por: opts.iniciado_por ?? null,
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`calculation_runs insert: ${runErr?.message}`);
  const runId = run.id;

  try {
    // ─── Sembrar formula_definitions (upsert) ─────────────────────
    const formulaIdByCodigo = await ensureFormulas(supabase);

    // ─── Cargar contexto ──────────────────────────────────────────
    const ctx = await loadContext(supabase, opts.versionId, runId, formulaIdByCodigo);

    // Filtrar periodos
    const periodos = opts.periodos && opts.periodos.length > 0
      ? opts.periodos
      : ctx.periodos;

    // Filtrar procesos por ord si vienen
    const procesos = ctx.procesos
      .filter(p => CALCULADORES[p.ord] !== undefined)
      .filter(p => !opts.procesosOrd || opts.procesosOrd.includes(p.ord))
      .sort((a, b) => a.orden_topologico - b.orden_topologico);

    // Reportar omitidos (proceso sin calculador registrado)
    for (const p of ctx.procesos) {
      if (!CALCULADORES[p.ord]) {
        omitidos.push({ ord: p.ord, razon: "calculador no implementado" });
      }
    }

    const writer = new SupabaseWriter(supabase, ctx);

    let totalCalculos = 0;
    let procesosCalculados = 0;
    for (const proceso of procesos) {
      const calc = CALCULADORES[proceso.ord];
      for (const periodo of periodos) {
        try {
          const result = await calc.run({ ctx, proceso, periodo, writer });
          await writer.writeCostoProceso(result, opts.versionId, runId);
          ctx.costoProcesoByKey.set(
            `${proceso.id}|${periodo}`,
            {
              costo_total: result.costo_total,
              costo_por_ton: result.costo_por_ton,
              calc_total_id: result.calc_total_id,
            }
          );
          procesosCalculados++;
          totalCalculos += 3; // ORD1 escribe 3 log entries; aproximación general
        } catch (e: any) {
          // Falla en un (proceso, periodo) no aborta todo — se registra y continúa.
          omitidos.push({
            ord: proceso.ord,
            razon: `${periodo}: ${e?.message ?? String(e)}`,
          });
        }
      }
    }

    const duracion = Date.now() - t0;
    await supabase
      .from("calculation_runs")
      .update({
        estado: "exitoso",
        finalizado_en: new Date().toISOString(),
        duracion_ms: duracion,
        total_calculos: totalCalculos,
      })
      .eq("id", runId);

    return {
      runId,
      estado: "exitoso",
      duracion_ms: duracion,
      total_calculos: totalCalculos,
      procesos_calculados: procesosCalculados,
      procesos_omitidos: omitidos,
      error_msg: null,
    };
  } catch (e: any) {
    const duracion = Date.now() - t0;
    const error_msg = e?.message ?? String(e);
    await supabase
      .from("calculation_runs")
      .update({
        estado: "error",
        finalizado_en: new Date().toISOString(),
        duracion_ms: duracion,
        error_msg,
      })
      .eq("id", runId);
    return {
      runId,
      estado: "error",
      duracion_ms: duracion,
      total_calculos: 0,
      procesos_calculados: 0,
      procesos_omitidos: omitidos,
      error_msg,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Sembrar formula_definitions (upsert por codigo) — devuelve mapa codigo→id
// ─────────────────────────────────────────────────────────────────

async function ensureFormulas(supabase: Client): Promise<Map<string, UUID>> {
  const codigos = Object.keys(FORMULA_REGISTRY);

  // 1) Leer existentes
  const { data: existing, error: selErr } = await supabase
    .from("formula_definitions")
    .select("id, codigo")
    .in("codigo", codigos);
  if (selErr) throw new Error(`formula_definitions select: ${selErr.message}`);

  const idByCodigo = new Map<string, UUID>(
    (existing ?? []).map(r => [r.codigo, r.id])
  );

  // 2) Insertar los que falten
  const faltantes = codigos.filter(c => !idByCodigo.has(c));
  if (faltantes.length > 0) {
    const rows = faltantes.map(c => {
      const def = FORMULA_REGISTRY[c];
      return {
        codigo: def.codigo,
        nombre: def.nombre,
        expresion: def.expresion,
        parametros: def.parametros as never,
        retorno_unidad: def.retorno_unidad,
        version: 1,
        activa: true,
      };
    });
    const { data: inserted, error: insErr } = await supabase
      .from("formula_definitions")
      .insert(rows)
      .select("id, codigo");
    if (insErr) throw new Error(`formula_definitions insert: ${insErr.message}`);
    for (const r of inserted ?? []) idByCodigo.set(r.codigo, r.id);
  }

  return idByCodigo;
}

// ─────────────────────────────────────────────────────────────────
// Cargar contexto de cálculo desde Supabase
// ─────────────────────────────────────────────────────────────────

async function loadContext(
  supabase: Client,
  versionId: UUID,
  runId: UUID,
  formulaIdByCodigo: Map<string, UUID>
): Promise<CalcContext> {
  const [
    { data: procesosRaw, error: procErr },
    { data: matsRaw, error: matErr },
    { data: preciosRaw, error: precErr },
    { data: pctRaw, error: pctErr },
    { data: recetasRaw, error: recErr },
    { data: lineasRaw, error: lnErr },
    { data: enerRaw, error: enerErr },
    { data: rendRaw, error: rendErr },
  ] = await Promise.all([
    supabase.from("procesos").select("id, ord, material, nombre, orden_topologico").eq("activo", true),
    supabase.from("materiales").select("id, codigo, nombre, unidad_base").eq("activo", true),
    supabase.from("precios_insumos").select("material_id, proveedor, periodo, precio_unitario, unidad").eq("version_id", versionId),
    supabase.from("porcentajes_consumo").select("material_id, proveedor, periodo, porcentaje").eq("version_id", versionId),
    supabase.from("recetas").select("id, producto_id, proceso_id, periodo").eq("version_id", versionId),
    supabase.from("receta_lineas").select("receta_id, material_id, porcentaje, orden"),
    supabase.from("parametros_energia").select("periodo, precio_contrato, precio_restricciones, cargos_fijos, kwh_ton_proceso, pci_combustibles, kcal_tck_total, pci_ponderado_horno, composicion_horno, kcal_tck, pct_energia_carbones, pct_energia_alternos, pct_energia_diesel, pci_ponderado_carbones, pci_ponderado_alternos, pci_ponderado_diesel").eq("version_id", versionId),
    supabase.from("rendimientos").select("proceso_id, periodo, horas_mes, produccion_ton, horas_operacion_efectivas, rendimiento_ton_hr, disponibilidad, utilizacion, oee").eq("version_id", versionId),
  ]);

  if (procErr) throw new Error(`procesos: ${procErr.message}`);
  if (matErr) throw new Error(`materiales: ${matErr.message}`);
  if (precErr) throw new Error(`precios_insumos: ${precErr.message}`);
  if (pctErr) throw new Error(`porcentajes_consumo: ${pctErr.message}`);
  if (recErr) throw new Error(`recetas: ${recErr.message}`);
  if (lnErr) throw new Error(`receta_lineas: ${lnErr.message}`);
  if (enerErr) throw new Error(`parametros_energia: ${enerErr.message}`);
  if (rendErr) throw new Error(`rendimientos: ${rendErr.message}`);

  const materialesById = new Map<UUID, MaterialMeta>();
  const materialesByCodigo = new Map<string, MaterialMeta>();
  for (const m of matsRaw ?? []) {
    const meta: MaterialMeta = { id: m.id, codigo: m.codigo, nombre: m.nombre, unidad_base: m.unidad_base };
    materialesById.set(m.id, meta);
    materialesByCodigo.set(m.codigo, meta);
  }

  const preciosByMatPeriodo = new Map<string, PrecioCtx>();
  const periodosSet = new Set<Periodo>();
  for (const p of preciosRaw ?? []) {
    const k = `${p.material_id}|${p.periodo}|${p.proveedor ?? ""}`;
    preciosByMatPeriodo.set(k, {
      material_id: p.material_id,
      proveedor: p.proveedor,
      periodo: p.periodo,
      precio: Number(p.precio_unitario),
      unidad: p.unidad,
    });
    periodosSet.add(p.periodo);
  }

  const pctConsumoByKey = new Map<string, PctConsumoCtx>();
  for (const p of pctRaw ?? []) {
    const k = `${p.material_id}|${p.periodo}|${p.proveedor}`;
    pctConsumoByKey.set(k, {
      material_id: p.material_id,
      proveedor: p.proveedor,
      periodo: p.periodo,
      porcentaje: Number(p.porcentaje),
    });
  }

  const lineasByReceta = new Map<UUID, RecetaCtx["lineas"]>();
  for (const ln of lineasRaw ?? []) {
    const arr = lineasByReceta.get(ln.receta_id) ?? [];
    arr.push({ material_id: ln.material_id, porcentaje: Number(ln.porcentaje), orden: ln.orden });
    lineasByReceta.set(ln.receta_id, arr);
  }

  const recetasByProcesoPeriodo = new Map<string, RecetaCtx>();
  for (const r of recetasRaw ?? []) {
    const k = `${r.proceso_id}|${r.periodo}`;
    recetasByProcesoPeriodo.set(k, {
      receta_id: r.id,
      producto_id: r.producto_id,
      proceso_id: r.proceso_id,
      periodo: r.periodo,
      lineas: lineasByReceta.get(r.id) ?? [],
    });
  }

  const procesos: ProcesoMeta[] = (procesosRaw ?? [])
    .map(p => ({
      id: p.id,
      ord: p.ord,
      material: p.material,
      nombre: p.nombre,
      orden_topologico: p.orden_topologico,
    }))
    .sort((a, b) => a.orden_topologico - b.orden_topologico);

  // ─── Fase 1.5: parametros_energia + rendimientos ────────────────────────
  const parametrosEnergiaByPeriodo = new Map<Periodo, ParametrosEnergiaCtx>();
  for (const e of enerRaw ?? []) {
    parametrosEnergiaByPeriodo.set(e.periodo, {
      periodo: e.periodo,
      precio_contrato:      e.precio_contrato      != null ? Number(e.precio_contrato)      : null,
      precio_restricciones: e.precio_restricciones != null ? Number(e.precio_restricciones) : null,
      cargos_fijos:         e.cargos_fijos         != null ? Number(e.cargos_fijos)         : null,
      kwh_ton_proceso:      (e.kwh_ton_proceso as Record<string, number> | null) ?? null,
      pci_combustibles:     (e.pci_combustibles as Record<string, number> | null) ?? null,
      kcal_tck_total:       e.kcal_tck_total       != null ? Number(e.kcal_tck_total)       : null,
      pci_ponderado_horno:  e.pci_ponderado_horno  != null ? Number(e.pci_ponderado_horno)  : null,
      composicion_horno:    (e.composicion_horno as Record<string, number> | null) ?? null,
      kcal_tck:                (e as any).kcal_tck                != null ? Number((e as any).kcal_tck)                : null,
      pct_energia_carbones:    (e as any).pct_energia_carbones    != null ? Number((e as any).pct_energia_carbones)    : null,
      pct_energia_alternos:    (e as any).pct_energia_alternos    != null ? Number((e as any).pct_energia_alternos)    : null,
      pct_energia_diesel:      (e as any).pct_energia_diesel      != null ? Number((e as any).pct_energia_diesel)      : null,
      pci_ponderado_carbones:  (e as any).pci_ponderado_carbones  != null ? Number((e as any).pci_ponderado_carbones)  : null,
      pci_ponderado_alternos:  (e as any).pci_ponderado_alternos  != null ? Number((e as any).pci_ponderado_alternos)  : null,
      pci_ponderado_diesel:    (e as any).pci_ponderado_diesel    != null ? Number((e as any).pci_ponderado_diesel)    : null,
    });
  }

  const rendimientosByProcesoPeriodo = new Map<string, RendimientoCtx>();
  for (const r of rendRaw ?? []) {
    const k = `${r.proceso_id}|${r.periodo}`;
    rendimientosByProcesoPeriodo.set(k, {
      proceso_id: r.proceso_id,
      periodo: r.periodo,
      horas_mes:                 r.horas_mes                 != null ? Number(r.horas_mes)                 : null,
      produccion_ton:            r.produccion_ton            != null ? Number(r.produccion_ton)            : null,
      horas_operacion_efectivas: r.horas_operacion_efectivas != null ? Number(r.horas_operacion_efectivas) : null,
      rendimiento_ton_hr:        r.rendimiento_ton_hr        != null ? Number(r.rendimiento_ton_hr)        : null,
      disponibilidad:            r.disponibilidad            != null ? Number(r.disponibilidad)            : null,
      utilizacion:               r.utilizacion               != null ? Number(r.utilizacion)               : null,
      oee:                       r.oee                       != null ? Number(r.oee)                       : null,
    });
  }

  return {
    versionId,
    runId,
    periodos: Array.from(periodosSet).sort(),
    procesos,
    materialesById,
    materialesByCodigo,
    preciosByMatPeriodo,
    pctConsumoByKey,
    recetasByProcesoPeriodo,
    formulaIdByCodigo,
    costoProcesoByKey: new Map(),
    parametrosEnergiaByPeriodo,
    rendimientosByProcesoPeriodo,
  };
}
