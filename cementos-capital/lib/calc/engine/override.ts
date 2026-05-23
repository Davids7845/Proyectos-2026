// Override + propagación de un nodo de calculation_log hacia sus ancestros.
//
// Algoritmo:
//   1. Actualizar el nodo objetivo: es_override=true, valor_original=<previo>, valor_resultado=<nuevo>
//   2. BFS ascendente por calculation_log_deps (depende_de_id = nodeId → calculo_id = ancestor)
//   3. Para cada ancestro:
//      - Releer sus dependencias (calculation_log_deps rows where calculo_id = ancestor)
//      - Para cada dep, leer el valor actual del hijo y, si la dep tiene rol_parametro,
//        sobreescribir parametros_entrada[rol] = valor_hijo
//      - Re-ejecutar la fórmula con los parámetros actualizados
//      - Update valor_resultado + formula_expresion + parametros_entrada (sin tocar es_override)
//      - Si calculo_tipo === 'costo_proceso_total', sincronizar costo_proceso (proceso × periodo)
//   4. Continuar mientras haya ancestros nuevos por procesar.

import type { Client, UUID } from "./context";
import { FORMULA_REGISTRY } from "@/lib/calc/formulas";
import type { FormulaParams } from "./types";

export interface OverrideResult {
  nodos_actualizados: number;
  ancestros_recalculados: number;
  costo_proceso_actualizado: number;
  warnings: string[];
}

interface LogRow {
  id: string;
  calculo_tipo: string;
  valor_resultado: string;
  parametros_entrada: Record<string, unknown> | null;
  es_override: boolean;
  valor_original: string | null;
  motivo_override: string | null;
  formula_id: string;
  proceso_id: string | null;
  periodo: string;
}

async function loadLog(supabase: Client, ids: UUID[]): Promise<LogRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("calculation_log")
    .select("id, calculo_tipo, valor_resultado, parametros_entrada, es_override, valor_original, motivo_override, formula_id, proceso_id, periodo")
    .in("id", ids);
  if (error) throw new Error(`calculation_log: ${error.message}`);
  return (data ?? []) as unknown as LogRow[];
}

async function loadFormulaCodigos(
  supabase: Client,
  formulaIds: UUID[]
): Promise<Map<UUID, string>> {
  if (formulaIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("formula_definitions")
    .select("id, codigo")
    .in("id", formulaIds);
  if (error) throw new Error(`formula_definitions: ${error.message}`);
  return new Map((data ?? []).map(r => [r.id, r.codigo]));
}

async function findDependents(supabase: Client, calcId: UUID): Promise<UUID[]> {
  const { data, error } = await supabase
    .from("calculation_log_deps")
    .select("calculo_id")
    .eq("depende_de_id", calcId);
  if (error) throw new Error(`deps: ${error.message}`);
  return (data ?? []).map(r => r.calculo_id);
}

async function loadDepsOf(
  supabase: Client,
  calcIds: UUID[]
): Promise<Map<UUID, Array<{ depende_de_id: UUID; rol_parametro: string | null }>>> {
  if (calcIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("calculation_log_deps")
    .select("calculo_id, depende_de_id, rol_parametro")
    .in("calculo_id", calcIds);
  if (error) throw new Error(`deps_of: ${error.message}`);
  const m = new Map<UUID, Array<{ depende_de_id: UUID; rol_parametro: string | null }>>();
  for (const d of data ?? []) {
    const arr = m.get(d.calculo_id) ?? [];
    arr.push({ depende_de_id: d.depende_de_id, rol_parametro: d.rol_parametro });
    m.set(d.calculo_id, arr);
  }
  return m;
}

export async function applyOverride(
  supabase: Client,
  calcId: UUID,
  nuevoValor: number,
  motivo: string
): Promise<OverrideResult> {
  const result: OverrideResult = {
    nodos_actualizados: 0,
    ancestros_recalculados: 0,
    costo_proceso_actualizado: 0,
    warnings: [],
  };

  // ─── 1) Cargar nodo objetivo y aplicar override ────────────────
  const [target] = await loadLog(supabase, [calcId]);
  if (!target) throw new Error(`calcId ${calcId} no encontrado`);

  const valorOriginal = target.es_override
    ? target.valor_original                       // ya tiene original → preservar
    : target.valor_resultado;

  const { error: upErr } = await supabase
    .from("calculation_log")
    .update({
      valor_resultado: nuevoValor,
      es_override: true,
      valor_original: valorOriginal != null ? Number(valorOriginal) : null,
      motivo_override: motivo,
    })
    .eq("id", calcId);
  if (upErr) throw new Error(`override update: ${upErr.message}`);
  result.nodos_actualizados++;

  // Sincronizar costo_proceso si el nodo overrideado YA es la raíz
  if (target.calculo_tipo === "costo_proceso_total") {
    await syncCostoProceso(supabase, calcId, nuevoValor);
    result.costo_proceso_actualizado++;
  }

  // ─── 2) BFS ascendente ─────────────────────────────────────────
  const visited = new Set<UUID>([calcId]);
  let frontier = await findDependents(supabase, calcId);

  while (frontier.length > 0) {
    const nextFrontier: UUID[] = [];
    const pendientes = frontier.filter(id => !visited.has(id));
    for (const id of pendientes) visited.add(id);

    const ancestros = await loadLog(supabase, pendientes);
    const depsMap = await loadDepsOf(supabase, pendientes);

    // IDs hijos referenciados (para releer valores frescos)
    const hijoIds = new Set<UUID>();
    for (const deps of Array.from(depsMap.values())) for (const d of deps) hijoIds.add(d.depende_de_id);
    const hijosLog = await loadLog(supabase, Array.from(hijoIds));
    const hijoById = new Map(hijosLog.map(h => [h.id, h]));

    const formulaCodigos = await loadFormulaCodigos(
      supabase,
      Array.from(new Set(ancestros.map(a => a.formula_id)))
    );

    for (const ancestor of ancestros) {
      const codigo = formulaCodigos.get(ancestor.formula_id);
      if (!codigo) {
        result.warnings.push(`Ancestro ${ancestor.id}: formula_id ${ancestor.formula_id} sin codigo`);
        continue;
      }
      const formula = FORMULA_REGISTRY[codigo];
      if (!formula) {
        result.warnings.push(`Ancestro ${ancestor.id}: fórmula ${codigo} no registrada`);
        continue;
      }

      // Construir parámetros actualizados
      const params: FormulaParams = {};
      if (ancestor.parametros_entrada) {
        for (const [k, v] of Object.entries(ancestor.parametros_entrada)) {
          if (typeof v === "number" || typeof v === "string") params[k] = v;
          else params[k] = JSON.stringify(v);   // permite serializar arrays (mezcla ponderada)
        }
      }
      const deps = depsMap.get(ancestor.id) ?? [];
      for (const dep of deps) {
        if (!dep.rol_parametro) continue;
        const hijo = hijoById.get(dep.depende_de_id);
        if (!hijo) continue;
        params[dep.rol_parametro] = Number(hijo.valor_resultado);
      }

      // Re-ejecutar
      let nuevo;
      try {
        nuevo = formula.fn(params);
      } catch (e: any) {
        result.warnings.push(`Ancestro ${ancestor.id}: error re-ejecutando ${codigo}: ${e?.message ?? e}`);
        continue;
      }

      const { error: ancErr } = await supabase
        .from("calculation_log")
        .update({
          valor_resultado: nuevo.valor,
          // expresion + params se quedan tal cual; vinieron del run original.
          // Si quisiéramos podríamos actualizar formula_expresion = nuevo.expresion_evaluada,
          // pero RLS bloquea updates a formula_expresion en versiones congeladas.
        })
        .eq("id", ancestor.id);
      if (ancErr) {
        result.warnings.push(`Update ancestro ${ancestor.id}: ${ancErr.message}`);
        continue;
      }
      result.ancestros_recalculados++;

      if (ancestor.calculo_tipo === "costo_proceso_total") {
        await syncCostoProceso(supabase, ancestor.id, nuevo.valor);
        result.costo_proceso_actualizado++;
      }

      // Encolar dependientes del ancestro
      const more = await findDependents(supabase, ancestor.id);
      for (const m of more) if (!visited.has(m)) nextFrontier.push(m);
    }

    frontier = nextFrontier;
  }

  return result;
}

/** Restaura un nodo previamente overrideado: vuelve al valor_original y re-propaga. */
export async function clearOverride(
  supabase: Client,
  calcId: UUID
): Promise<OverrideResult> {
  const [target] = await loadLog(supabase, [calcId]);
  if (!target) throw new Error(`calcId ${calcId} no encontrado`);
  if (!target.es_override || target.valor_original == null) {
    throw new Error("el nodo no está overrideado");
  }

  const original = Number(target.valor_original);
  const { error } = await supabase
    .from("calculation_log")
    .update({
      valor_resultado: original,
      es_override: false,
      valor_original: null,
      motivo_override: null,
    })
    .eq("id", calcId);
  if (error) throw new Error(`clear override: ${error.message}`);

  // Re-propagar usando el flujo de override pero sin marcar es_override.
  // applyOverride ya gestiona el caso: aquí ya limpiamos el flag, así que llamamos
  // a propagación con un atajo que no toca el target (lo acabamos de hacer).
  // Por simplicidad: ejecutamos el mismo applyOverride con valor original; eso re-marcaría
  // el flag. En vez de eso, hacemos sólo el paso de BFS ascendente directamente.

  const result: OverrideResult = {
    nodos_actualizados: 1,
    ancestros_recalculados: 0,
    costo_proceso_actualizado: 0,
    warnings: [],
  };

  if (target.calculo_tipo === "costo_proceso_total") {
    await syncCostoProceso(supabase, calcId, original);
    result.costo_proceso_actualizado++;
  }

  await propagateUpward(supabase, calcId, result);
  return result;
}

/** Sólo BFS ascendente sin modificar el target. Extraído para reuso. */
async function propagateUpward(
  supabase: Client,
  startCalcId: UUID,
  result: OverrideResult
): Promise<void> {
  const visited = new Set<UUID>([startCalcId]);
  let frontier = await findDependents(supabase, startCalcId);

  while (frontier.length > 0) {
    const nextFrontier: UUID[] = [];
    const pendientes = frontier.filter(id => !visited.has(id));
    for (const id of pendientes) visited.add(id);

    const ancestros = await loadLog(supabase, pendientes);
    const depsMap = await loadDepsOf(supabase, pendientes);
    const hijoIds = new Set<UUID>();
    for (const deps of Array.from(depsMap.values())) for (const d of deps) hijoIds.add(d.depende_de_id);
    const hijosLog = await loadLog(supabase, Array.from(hijoIds));
    const hijoById = new Map(hijosLog.map(h => [h.id, h]));
    const formulaCodigos = await loadFormulaCodigos(
      supabase,
      Array.from(new Set(ancestros.map(a => a.formula_id)))
    );

    for (const ancestor of ancestros) {
      const codigo = formulaCodigos.get(ancestor.formula_id);
      if (!codigo) { result.warnings.push(`Ancestro ${ancestor.id}: sin codigo`); continue; }
      const formula = FORMULA_REGISTRY[codigo];
      if (!formula) { result.warnings.push(`Ancestro ${ancestor.id}: fórmula ${codigo} no registrada`); continue; }

      const params: FormulaParams = {};
      if (ancestor.parametros_entrada) {
        for (const [k, v] of Object.entries(ancestor.parametros_entrada)) {
          if (typeof v === "number" || typeof v === "string") params[k] = v;
          else params[k] = JSON.stringify(v);
        }
      }
      const deps = depsMap.get(ancestor.id) ?? [];
      for (const dep of deps) {
        if (!dep.rol_parametro) continue;
        const hijo = hijoById.get(dep.depende_de_id);
        if (!hijo) continue;
        params[dep.rol_parametro] = Number(hijo.valor_resultado);
      }
      let nuevo;
      try { nuevo = formula.fn(params); }
      catch (e: any) { result.warnings.push(`re-exec ${ancestor.id}: ${e?.message ?? e}`); continue; }

      const { error } = await supabase
        .from("calculation_log")
        .update({ valor_resultado: nuevo.valor })
        .eq("id", ancestor.id);
      if (error) { result.warnings.push(`update ${ancestor.id}: ${error.message}`); continue; }
      result.ancestros_recalculados++;

      if (ancestor.calculo_tipo === "costo_proceso_total") {
        await syncCostoProceso(supabase, ancestor.id, nuevo.valor);
        result.costo_proceso_actualizado++;
      }

      const more = await findDependents(supabase, ancestor.id);
      for (const m of more) if (!visited.has(m)) nextFrontier.push(m);
    }
    frontier = nextFrontier;
  }
}

async function syncCostoProceso(supabase: Client, calcTotalId: UUID, nuevoTotal: number): Promise<void> {
  // costo_proceso.calc_total_id = calcTotalId apunta al log de tipo costo_proceso_total
  const { error } = await supabase
    .from("costo_proceso")
    .update({
      costo_total: nuevoTotal,
      costo_por_ton: nuevoTotal,
      costo_total_arrastrado: nuevoTotal,
      costo_por_ton_arrastrado: nuevoTotal,
    })
    .eq("calc_total_id", calcTotalId);
  if (error) throw new Error(`syncCostoProceso: ${error.message}`);
}
