// Helper compartido: loguea componentes auxiliares (energía + costos fijos)
// para cualquier proceso. Extrae la lógica duplicada de _receta_base.ts y de
// los calculadores custom (ORD 1, ORD 2).
//
// Contratos:
//  - conEnergia=true → busca override en energiaOverrideByKey; si no existe,
//    usa parametrosEnergiaByPeriodo con la clave energiaKey (o material/nombre).
//  - conCostosFijos=true → itera costosFijosByProcesoPeriodo y loguea uno
//    por uno con calculo_tipo="costo_fijo_proceso".

import { fn as calcEnergiaProceso } from "@/lib/calc/formulas/costo_energia_proceso";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoMeta,
  UUID,
} from "@/lib/calc/engine/context";

export interface AuxComponentesOpts {
  conEnergia?: boolean;
  energiaKey?: string;
  conCostosFijos?: boolean;
  /**
   * Fase 3: si true, los costos fijos con valor 0 se registran igual en el log
   * (como `costo_fijo_proceso` con valor_resultado=0) en lugar de omitirse.
   * Permite que la vista muestre TODOS los componentes esperados del Excel,
   * incluyendo los que no aplican este período (decisión #8: placeholders).
   */
  registrarPlaceholders?: boolean;
  /**
   * Fase 3: si true, clasifica cada costo fijo en su categoría (repuesto,
   * servicio, regalía, combustible_aux, flete) y devuelve totales granulares.
   * El total agregado (`costo_servicios`) no cambia — es la suma de todos.
   */
  clasificar?: boolean;
  /**
   * Capa de agregación (plan_movimientos): si se pasa, el helper escribe un
   * movimiento por componente auxiliar (energía + cada costo fijo) usando la
   * producción normalizada indicada. Permite el cálculo de promedio ponderado.
   * Si se omite, no se escriben movimientos (comportamiento original).
   */
  movimientos?: { produccion: number };
}

export type CategoriaComponente =
  | "repuesto" | "servicio" | "regalia" | "combustible_aux" | "flete" | "fijo";

export interface AuxComponentesResult {
  costo_energia:   number | null;
  energiaCalcId:   UUID | null;
  costo_servicios: number | null;  // suma de TODOS los fijos no-cero (backward compat)
  fijosCalcIds:    UUID[];
  fijosRolDeps:    Record<string, string>;
  // ── Fase 3: desglose granular (sólo poblado si opts.clasificar) ──────────
  costo_repuestos:        number | null;
  costo_regalias:         number | null;
  costo_combustible_aux:  number | null;
  costo_flete:            number | null;
  /** Nombres (lowercase) de los componentes registrados, para warnings. */
  componentesRegistrados: Set<string>;
  /** IDs de logs de placeholders (valor 0) registrados. */
  placeholderCalcIds:     UUID[];
}

/**
 * Clasifica un componente de costo fijo según su nombre/código en una de las
 * categorías canónicas. Heurística basada en palabras clave del Excel.
 */
export function clasificarComponente(nombre: string, codigo?: string): CategoriaComponente {
  const n = (nombre ?? "").toLowerCase();
  const c = (codigo ?? "").toLowerCase();
  if (/regal/i.test(n) || /regal/i.test(c)) return "regalia";
  if (/flete/i.test(n) || /flete|^fle_/i.test(c)) return "flete";
  if (/gasoil|diesel/i.test(n) || /gasoil|diesel/i.test(c)) return "combustible_aux";
  if (/cargue|descargue|cargador|transporte|sellado|dosific|desatasque|empaque|unitario|fijo \+ horas|servicio/i.test(n)) return "servicio";
  if (/barras|placas|material dique|l[áa]minas|anillos|tapas|separadores|cuerpos|moledores|refractari|enfriador|ductos|masas|segmentos|variables|elementos sellad|desmantel/i.test(n)) return "repuesto";
  return "fijo";
}

export async function logComponentesAuxiliares(
  args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter },
  opts: AuxComponentesOpts,
): Promise<AuxComponentesResult> {
  const { ctx, proceso, periodo, writer } = args;

  // ── Energía eléctrica ─────────────────────────────────────────────────────
  let costo_energia: number | null = null;
  let energiaCalcId: UUID | null = null;

  if (opts.conEnergia) {
    const enOver = ctx.energiaOverrideByKey?.get(`${proceso.id}|${periodo}`);
    if (enOver) {
      const valor = enOver.kwh_ton * enOver.precio_efectivo;
      costo_energia = valor;
      energiaCalcId = await writer.log({
        calculo_tipo: "costo_energia_proceso",
        proceso_id: proceso.id,
        periodo,
        concepto: `Costo Energía Eléctrica — ${proceso.nombre} (override budget)`,
        valor_resultado: valor,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_ENERGIA_PROCESO_v1",
        formula_expresion: `kwh_ton(${enOver.kwh_ton}) × precio_efectivo(${enOver.precio_efectivo}) = ${valor}`,
        parametros_entrada: {
          kwh_ton: enOver.kwh_ton,
          precio_efectivo: enOver.precio_efectivo,
          fuente: "Excel Costo!N/O override",
        },
        nivel_jerarquia: 1,
      });
      if (opts.movimientos) {
        const prod = opts.movimientos.produccion;
        await writer.writeMovimiento({
          proceso_id: proceso.id, periodo, tipo: "energia",
          codigo: `energia_${opts.energiaKey ?? proceso.material?.toLowerCase() ?? "proceso"}`,
          nombre: "Energía Eléctrica",
          produccion_ton: prod,
          cantidad:       enOver.kwh_ton * prod,
          costo_unitario: enOver.precio_efectivo,
          valor:          valor * prod,
        }, ctx.versionId, ctx.runId);
      }
    } else {
      const paramsEner = ctx.parametrosEnergiaByPeriodo?.get(periodo);
      if (paramsEner) {
        const kwhMap = paramsEner.kwh_ton_proceso ?? {};
        const candidates = [
          opts.energiaKey,
          proceso.material?.toLowerCase(),
          proceso.nombre?.toLowerCase(),
        ].filter((x): x is string => typeof x === "string");
        let kwh = 0;
        for (const c of candidates) {
          if (kwhMap[c] != null) { kwh = kwhMap[c]; break; }
        }
        if (kwh > 0) {
          const f = calcEnergiaProceso({
            kwh_ton: kwh,
            precio_contrato:      paramsEner.precio_contrato      ?? 0,
            precio_restricciones: paramsEner.precio_restricciones ?? 0,
            cargos_fijos:         paramsEner.cargos_fijos         ?? 0,
          });
          costo_energia = f.valor;
          energiaCalcId = await writer.log({
            calculo_tipo: "costo_energia_proceso",
            proceso_id: proceso.id,
            periodo,
            concepto: `Costo Energía Eléctrica — ${proceso.nombre}`,
            valor_resultado: f.valor,
            unidad: "COP/Ton",
            formula_codigo: "COSTO_ENERGIA_PROCESO_v1",
            formula_expresion: f.expresion_evaluada,
            parametros_entrada: {
              kwh_ton: kwh,
              precio_contrato: paramsEner.precio_contrato,
              precio_restricciones: paramsEner.precio_restricciones,
              cargos_fijos: paramsEner.cargos_fijos,
            },
            nivel_jerarquia: 1,
          });
          if (opts.movimientos) {
            const prod = opts.movimientos.produccion;
            const precio_kwh = kwh > 0 ? f.valor / kwh : 0;
            await writer.writeMovimiento({
              proceso_id: proceso.id, periodo, tipo: "energia",
              codigo: `energia_${opts.energiaKey ?? proceso.material?.toLowerCase() ?? "proceso"}`,
              nombre: "Energía Eléctrica",
              produccion_ton: prod,
              cantidad:       kwh * prod,
              costo_unitario: precio_kwh,
              valor:          f.valor * prod,
            }, ctx.versionId, ctx.runId);
          }
        }
      }
    }
  }

  // ── Costos fijos (repuestos, servicios, regalías, etc.) ───────────────────
  let costo_servicios: number | null = null;
  const fijosCalcIds: UUID[] = [];
  const fijosRolDeps: Record<string, string> = {};
  const placeholderCalcIds: UUID[] = [];
  const componentesRegistrados = new Set<string>();
  const catTotals: Record<CategoriaComponente, number> = {
    repuesto: 0, servicio: 0, regalia: 0, combustible_aux: 0, flete: 0, fijo: 0,
  };

  if (opts.conCostosFijos) {
    const items = ctx.costosFijosByProcesoPeriodo?.get(`${proceso.id}|${periodo}`) ?? [];
    let suma = 0;
    for (const it of items) {
      // Capa de agregación: un movimiento por costo fijo (incluye los 0, que
      // aportan valor 0 al ponderado pero mantienen el catálogo de componentes).
      if (opts.movimientos) {
        const prod = opts.movimientos.produccion;
        await writer.writeMovimiento({
          proceso_id: proceso.id, periodo, tipo: "fijo",
          codigo: it.codigo, nombre: it.nombre,
          produccion_ton: prod,
          cantidad:       prod,
          costo_unitario: it.costo_por_ton,
          valor:          it.costo_por_ton * prod,
        }, ctx.versionId, ctx.runId);
      }
      // Placeholder (valor 0): registrar sólo si opts.registrarPlaceholders.
      if (it.costo_por_ton === 0) {
        if (!opts.registrarPlaceholders) continue;
        const phId = await writer.log({
          calculo_tipo: "costo_fijo_proceso",
          proceso_id: proceso.id,
          periodo,
          concepto: it.nombre,
          valor_resultado: 0,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `${it.codigo}: 0 COP/Ton (placeholder — no aplica este período)`,
          parametros_entrada: { codigo: it.codigo, nombre: it.nombre, costo_por_ton: 0, placeholder: true },
          nivel_jerarquia: 1,
        });
        placeholderCalcIds.push(phId);
        componentesRegistrados.add(it.nombre.toLowerCase());
        continue;
      }
      suma += it.costo_por_ton;
      const id = await writer.log({
        calculo_tipo: "costo_fijo_proceso",
        proceso_id: proceso.id,
        periodo,
        concepto: it.nombre,
        valor_resultado: it.costo_por_ton,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `${it.codigo}: ${it.costo_por_ton} COP/Ton (Excel)`,
        parametros_entrada: { codigo: it.codigo, nombre: it.nombre, costo_por_ton: it.costo_por_ton },
        nivel_jerarquia: 1,
      });
      fijosCalcIds.push(id);
      fijosRolDeps[id] = `fijo_${it.codigo.toLowerCase()}`;
      componentesRegistrados.add(it.nombre.toLowerCase());
      if (opts.clasificar) {
        const cat = clasificarComponente(it.nombre, it.codigo);
        catTotals[cat] += it.costo_por_ton;
      }
    }
    if (suma > 0) costo_servicios = suma;
  }

  return {
    costo_energia, energiaCalcId, costo_servicios, fijosCalcIds, fijosRolDeps,
    costo_repuestos:       opts.clasificar && catTotals.repuesto > 0 ? catTotals.repuesto : null,
    costo_regalias:        opts.clasificar && catTotals.regalia > 0 ? catTotals.regalia : null,
    costo_combustible_aux: opts.clasificar && catTotals.combustible_aux > 0 ? catTotals.combustible_aux : null,
    costo_flete:           opts.clasificar && catTotals.flete > 0 ? catTotals.flete : null,
    componentesRegistrados,
    placeholderCalcIds,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Capa de agregación (plan_movimientos): helpers compartidos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Producción normalizada del proceso×periodo para el cálculo del ponderado.
 * Usa la producción real de `rendimientos` si existe; si no, normaliza a 1 ton
 * (promedio ponderado = promedio simple de los totales mensuales).
 */
export function produccionNormalizada(ctx: CalcContext, proceso_id: UUID, periodo: Periodo): number {
  const prod = ctx.rendimientosByProcesoPeriodo?.get(`${proceso_id}|${periodo}`)?.produccion_ton;
  return prod != null && prod > 0 ? prod : 1;
}

/**
 * Escribe un movimiento de materia prima por cada componente de receta.
 * cantidad = pct × producción · valor = precio × pct × producción.
 * La suma de los `valor` reproduce el costo de MP del proceso.
 */
export async function writeMovimientosMp(
  args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter },
  produccion: number,
  componentes: Array<{ codigo: string; nombre: string; pct: number; precio: number }>,
): Promise<void> {
  const { ctx, proceso, periodo, writer } = args;
  for (const c of componentes) {
    await writer.writeMovimiento({
      proceso_id: proceso.id, periodo, tipo: "mp",
      codigo: c.codigo, nombre: c.nombre,
      produccion_ton: produccion,
      cantidad:       c.pct * produccion,
      costo_unitario: c.precio,
      valor:          c.precio * c.pct * produccion,
    }, ctx.versionId, ctx.runId);
  }
}
