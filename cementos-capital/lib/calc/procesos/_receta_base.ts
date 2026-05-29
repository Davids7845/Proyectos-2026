// Lógica compartida para procesos basados en receta + componentes (derivados o directos).
//
// Patrón:
//   1) Para cada línea de la receta: si el material está en `derivedByCodigo`,
//      crear wrapper `precio_componente_derivado` que apunta al costo arrastrado
//      del proceso productor. Si no, crear `precio_componente_directo` con el
//      precio de `precios_insumos`.
//   2) Calcular el MP con COSTO_MP_RECETA_v1 — depende de los wrappers, cada
//      uno con `rol_parametro = precio_<codigo>` para que override propague.
//   3) Crear `costo_proceso_total` con COSTO_PROCESO_SUMA_v1 sobre el MP.
//
// Usado por ORD 3 (Crudo), ORD 4 (Carbón), ORD 5 (Clinker), ORD 6 (Cemento UG),
// ORD 7 (Cemento ART) y futuros procesos con la misma estructura.

import { fn as calcMpReceta } from "@/lib/calc/formulas/costo_mp_receta";
import { logComponentesAuxiliares } from "./_componentes_proceso";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoMeta,
  ProcesoResult,
  UUID,
} from "@/lib/calc/engine/context";

export interface RunRecetaOpts {
  /** Prefijo de error, p.ej. "ORD3" — sólo para mensajes legibles. */
  errPrefix: string;
  /** Descripción del producto para el mensaje de "no hay receta". */
  productoNombre: string;
  /** Valor de `calculo_tipo` para el log del MP (p.ej. "costo_mp_crudo"). */
  calculoTipoMp: string;
  /** Concepto humano del log del MP (p.ej. "Costo Materia Prima — Harina Cruda"). */
  conceptoMp: string;
  /** Mapa código→ord del proceso productor para los componentes semielaborados. */
  derivedByCodigo: Record<string, number>;
  // ─── Fase 1.5: componentes no-MP (opt-in) ────────────────────────────────
  /** Si true y hay parámetros de energía + rendimiento, suma costo eléctrico. */
  conEnergia?: boolean;
  /** Si true y hay parámetros térmicos, suma costo de combustible (sólo ORD 5 hoy). */
  conCombustible?: boolean;
  /**
   * Nombre que se usa como clave en `parametrosEnergia.kwh_ton_proceso` para
   * encontrar el consumo eléctrico de este proceso. Si no se pasa, se prueban
   * `proceso.material` y `proceso.nombre` en lowercase.
   */
  energiaKey?: string;
  /**
   * Componentes derivados no listados en la receta del Excel pero que cascadean
   * desde otros procesos. Usado por ORD 5 (Clinker) para Carbón Molido y
   * Alternos cuyo consumo se calcula a partir del modelo térmico.
   * Cada item produce un calculo derivado adicional que suma al costo_total.
   */
  /**
   * Si true, suma los costos fijos definidos en `ctx.costosFijosByProcesoPeriodo`
   * (repuestos, servicios industriales, regalías, etc.). Cada item se loguea
   * individualmente y la suma se acumula en `costo_servicios`.
   */
  conCostosFijos?: boolean;
  /**
   * Fase 3: registra componentes en 0 como placeholders (decisión #8) para
   * que la vista muestre todos los componentes esperados del Excel.
   */
  registrarPlaceholders?: boolean;
  /**
   * Fase 3: clasifica los costos fijos en repuestos vs servicios para poblar
   * `costo_repuestos` y `costo_servicios` por separado en el resultado.
   * El total no cambia. ORD 5/6/7/16 no lo pasan → comportamiento original.
   */
  clasificar?: boolean;
  extraDerivedComponents?: Array<{
    /** Código del material producto del proceso productor (p.ej. "CARBONMOL"). */
    material_codigo: string;
    /** ORD del proceso productor para resolver costo arrastrado. */
    productor_ord: number;
    /** Etiqueta para el log (p.ej. "Carbón Molido — térmico"). */
    label: string;
    /**
     * Calcula el consumo (Ton combustible / Ton producto) a partir del contexto
     * y periodo. Debe devolver el valor + metadata para el log de trazabilidad.
     */
    consumo_calculator: (
      ctx: CalcContext,
      periodo: Periodo,
      proceso_id: UUID,
    ) => {
      valor: number;
      formula_codigo: string;
      formula_expresion: string;
      parametros_entrada: Record<string, unknown>;
    };
  }>;
}

export async function runRecetaProcess(
  args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter },
  opts: RunRecetaOpts,
): Promise<ProcesoResult> {
  const { ctx, proceso, periodo, writer } = args;
  const { errPrefix, productoNombre, calculoTipoMp, conceptoMp, derivedByCodigo } = opts;

  const receta = ctx.recetasByProcesoPeriodo.get(`${proceso.id}|${periodo}`);
  if (!receta) throw new Error(`${errPrefix} ${periodo}: no hay receta para ${productoNombre}`);
  if (receta.lineas.length === 0) throw new Error(`${errPrefix} ${periodo}: receta vacía`);

  interface Componente {
    material_codigo: string;
    material_nombre: string;
    pct: number;
    precio: number;
    precio_calc_id: UUID;
  }
  const componentes: Componente[] = [];

  for (const ln of receta.lineas) {
    const mat = ctx.materialesById.get(ln.material_id);
    if (!mat) throw new Error(`${errPrefix} ${periodo}: material ${ln.material_id} no encontrado`);

    // Consumo override (Fase 1.7): Excel Costo!N sustituye porcentaje de receta
    const consumoKey = `${proceso.id}|${mat.codigo}|${periodo}`;
    const pct = ctx.consumoOverrideByKey?.get(consumoKey) ?? ln.porcentaje;

    let precio: number;
    let precioCalcId: UUID;
    const productorOrd = derivedByCodigo[mat.codigo];

    if (productorOrd != null) {
      // Componente derivado: precio = costo arrastrado del proceso productor
      const productor = ctx.procesos.find(p => p.ord === productorOrd);
      if (!productor) throw new Error(`${errPrefix} ${periodo}: no se encontró proceso ORD ${productorOrd}`);
      const arrastrado = ctx.costoProcesoByKey.get(`${productor.id}|${periodo}`);
      if (!arrastrado) throw new Error(`${errPrefix} ${periodo}: ORD ${productorOrd} aún no calculado`);
      precio = arrastrado.costo_por_ton;

      precioCalcId = await writer.log({
        calculo_tipo: "precio_componente_derivado",
        proceso_id: proceso.id,
        material_id: mat.id,
        periodo,
        concepto: `Precio ${mat.nombre} (arrastrado de ORD ${productorOrd})`,
        valor_resultado: precio,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `precio = costo_por_ton de ORD ${productorOrd} = ${precio}`,
        parametros_entrada: { costo_arrastrado: precio },
        nivel_jerarquia: 2,
        depende_de: [arrastrado.calc_total_id],
        rol_dependencias: { [arrastrado.calc_total_id]: "costo_arrastrado" },
      });
    } else {
      // Precio override (Fase 1.7): Excel Costo!O sustituye precio de Datos
      const precioOverrideKey = `${proceso.id}|${mat.codigo}|${periodo}`;
      const precioOverride = ctx.precioMpOverrideByKey?.get(precioOverrideKey);
      if (precioOverride != null) {
        precio = precioOverride;
        precioCalcId = await writer.log({
          calculo_tipo: "precio_componente_directo",
          proceso_id: proceso.id,
          material_id: mat.id,
          periodo,
          concepto: `Precio ${mat.nombre} (override budget)`,
          valor_resultado: precio,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `precio = ${precio} (Excel Costo!O override)`,
          parametros_entrada: { precio_override: precio, fuente: "Excel Costo!O" },
          nivel_jerarquia: 2,
        });
      } else {
        const ki = `${mat.id}|${periodo}|`;
        // When a material has no price, try known equivalents. This covers the
        // common case where Excel imports caliza as CALTLVTRIT or yeso by provider.
        const PRECIO_FALLBACKS: Record<string, string[]> = {
          CALIZATRI: ["CALTLVTRIT"],
          YESO00001: ["YESO_PRADA", "YESO_MIRAND"],
        };
        let pFound = ctx.preciosByMatPeriodo.get(ki);
        if (!pFound) {
          for (const fbCode of PRECIO_FALLBACKS[mat.codigo] ?? []) {
            const fbMat = ctx.materialesByCodigo.get(fbCode);
            if (!fbMat) continue;
            pFound = ctx.preciosByMatPeriodo.get(`${fbMat.id}|${periodo}|`);
            if (pFound) break;
          }
        }
        if (!pFound) throw new Error(`${errPrefix} ${periodo}: falta precio para ${mat.codigo}`);
        precio = pFound.precio;

        precioCalcId = await writer.log({
          calculo_tipo: "precio_componente_directo",
          proceso_id: proceso.id,
          material_id: mat.id,
          periodo,
          concepto: `Precio ${mat.nombre}`,
          valor_resultado: precio,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `precio = ${precio} (precios_insumos)`,
          parametros_entrada: { precio_directo: precio },
          nivel_jerarquia: 2,
        });
      }
    }

    componentes.push({
      material_codigo: mat.codigo,
      material_nombre: mat.nombre,
      pct,
      precio,
      precio_calc_id: precioCalcId,
    });
  }

  const items = componentes.map(c => ({ codigo: c.material_codigo, nombre: c.material_nombre, pct: c.pct }));
  const mpParams: Record<string, number | string> = { items_json: JSON.stringify(items) };
  for (const c of componentes) mpParams[`precio_${c.material_codigo}`] = c.precio;

  const mpResult = calcMpReceta(mpParams);

  const rolDeps: Record<string, string> = {};
  for (const c of componentes) rolDeps[c.precio_calc_id] = `precio_${c.material_codigo}`;

  const mpId = await writer.log({
    calculo_tipo: calculoTipoMp,
    proceso_id: proceso.id,
    periodo,
    concepto: conceptoMp,
    valor_resultado: mpResult.valor,
    unidad: "COP/Ton",
    formula_codigo: "COSTO_MP_RECETA_v1",
    formula_expresion: mpResult.expresion_evaluada,
    parametros_entrada: mpParams,
    nivel_jerarquia: 1,
    depende_de: componentes.map(c => c.precio_calc_id),
    rol_dependencias: rolDeps,
  });

  // ─── Componentes no-MP: energía + costos fijos ───────────────────────────
  const aux = await logComponentesAuxiliares(
    { ctx, proceso, periodo, writer },
    { conEnergia: opts.conEnergia, energiaKey: opts.energiaKey, conCostosFijos: false },
  );
  const costo_energia  = aux.costo_energia;
  const energiaCalcId  = aux.energiaCalcId;

  // ─── Componentes derivados extra (Fase 1.6) ──────────────────────────────
  // ORD 5 (Clinker) usa esto para sumar Carbón Molido + Alternos cuyo consumo
  // viene del modelo térmico (no de la receta del Excel).
  let costo_combustible: number | null = null;
  const extraCalcIds: UUID[] = [];
  const extraRolDeps: Record<string, string> = {};
  if (opts.extraDerivedComponents && opts.extraDerivedComponents.length > 0) {
    let sumaExtra = 0;
    for (const ex of opts.extraDerivedComponents) {
      const productor = ctx.procesos.find(p => p.ord === ex.productor_ord);
      if (!productor) throw new Error(`${errPrefix} ${periodo}: no se encontró proceso productor ORD ${ex.productor_ord} para ${ex.material_codigo}`);
      const arrastrado = ctx.costoProcesoByKey.get(`${productor.id}|${periodo}`);
      if (!arrastrado) throw new Error(`${errPrefix} ${periodo}: ORD ${ex.productor_ord} aún no calculado (requerido para ${ex.material_codigo})`);
      const mat = ctx.materialesByCodigo.get(ex.material_codigo);
      if (!mat) throw new Error(`${errPrefix} ${periodo}: material ${ex.material_codigo} no en context`);

      const consumoRes = ex.consumo_calculator(ctx, periodo, proceso.id);
      const precioUnit = arrastrado.costo_por_ton;
      const costoExtra = consumoRes.valor * precioUnit;
      sumaExtra += costoExtra;

      const consumoCalcId = await writer.log({
        calculo_tipo: "consumo_combustible_horno",
        proceso_id: proceso.id,
        material_id: mat.id,
        periodo,
        concepto: `Consumo ${ex.label} (modelo térmico)`,
        valor_resultado: consumoRes.valor,
        unidad: "Ton/Ton",
        formula_codigo: consumoRes.formula_codigo,
        formula_expresion: consumoRes.formula_expresion,
        parametros_entrada: consumoRes.parametros_entrada,
        nivel_jerarquia: 2,
      });

      const costoExtraId = await writer.log({
        calculo_tipo: "costo_componente_derivado_termico",
        proceso_id: proceso.id,
        material_id: mat.id,
        periodo,
        concepto: `Costo ${ex.label} = consumo × precio arrastrado ORD ${ex.productor_ord}`,
        valor_resultado: costoExtra,
        unidad: "COP/Ton",
        formula_codigo: "COSTO_PROCESO_SUMA_v1",
        formula_expresion: `${consumoRes.valor} × ${precioUnit} = ${costoExtra}`,
        parametros_entrada: { consumo: consumoRes.valor, precio_arrastrado: precioUnit },
        nivel_jerarquia: 1,
        depende_de: [consumoCalcId, arrastrado.calc_total_id],
        rol_dependencias: {
          [consumoCalcId]: "consumo",
          [arrastrado.calc_total_id]: "precio_arrastrado",
        },
      });
      extraCalcIds.push(costoExtraId);
      extraRolDeps[costoExtraId] = `costo_${ex.material_codigo.toLowerCase()}`;
    }
    costo_combustible = sumaExtra;
  } else if (opts.conCombustible) {
    // Placeholder histórico (Fase 1.5) — sin extraDerivedComponents es no-op.
    const paramsEner = ctx.parametrosEnergiaByPeriodo?.get(periodo);
    void paramsEner;
  }

  const auxFijos = opts.conCostosFijos
    ? await logComponentesAuxiliares(
        { ctx, proceso, periodo, writer },
        {
          conEnergia: false, conCostosFijos: true,
          clasificar: opts.clasificar, registrarPlaceholders: opts.registrarPlaceholders,
        },
      )
    : null;
  const fijosTotal      = auxFijos?.costo_servicios ?? null;   // suma de todos los fijos
  const fijosCalcIds    = auxFijos?.fijosCalcIds    ?? [];
  const fijosRolDeps    = auxFijos?.fijosRolDeps    ?? {};
  // Desglose granular para el resultado (sólo si clasificar). El total usa
  // `fijosTotal` (suma completa), por lo que el costo_total no cambia.
  const res_costo_repuestos = opts.clasificar ? (auxFijos?.costo_repuestos ?? null) : null;
  const res_costo_servicios = opts.clasificar
    ? (((fijosTotal ?? 0) - (auxFijos?.costo_repuestos ?? 0)) > 0
        ? (fijosTotal ?? 0) - (auxFijos?.costo_repuestos ?? 0)
        : null)
    : fijosTotal;
  const costo_servicios = fijosTotal;

  const sumaExtras = (costo_energia ?? 0) + (costo_combustible ?? 0) + (costo_servicios ?? 0);
  const costo_total = mpResult.valor + sumaExtras;

  const dependeDe: UUID[] = [mpId];
  const rolDepsTotal: Record<string, string> = { [mpId]: "costo_mp" };
  if (energiaCalcId)     { dependeDe.push(energiaCalcId);     rolDepsTotal[energiaCalcId]     = "costo_energia"; }
  for (const ecid of extraCalcIds) {
    dependeDe.push(ecid);
    rolDepsTotal[ecid] = extraRolDeps[ecid];
  }
  for (const fid of fijosCalcIds) {
    dependeDe.push(fid);
    rolDepsTotal[fid] = fijosRolDeps[fid];
  }

  const totalId = await writer.log({
    calculo_tipo: "costo_proceso_total",
    proceso_id: proceso.id,
    periodo,
    concepto: `Costo total proceso — ${proceso.nombre}`,
    valor_resultado: costo_total,
    unidad: "COP/Ton",
    formula_codigo: "COSTO_PROCESO_SUMA_v1",
    formula_expresion:
      `costo_mp=${mpResult.valor}` +
      (costo_energia     != null ? ` + costo_energia=${costo_energia}` : "") +
      (costo_combustible != null ? ` + costo_combustible=${costo_combustible}` : "") +
      (costo_servicios   != null ? ` + costo_servicios=${costo_servicios}` : "") +
      ` → total=${costo_total}`,
    parametros_entrada: {
      costo_mp: mpResult.valor,
      costo_energia,
      costo_combustible,
      costo_servicios,
    },
    nivel_jerarquia: 0,
    depende_de: dependeDe,
    rol_dependencias: rolDepsTotal,
  });

  return {
    proceso_id: proceso.id,
    periodo,
    costo_materia_prima: mpResult.valor,
    costo_combustible,
    costo_energia,
    costo_repuestos:     res_costo_repuestos,
    costo_servicios:     res_costo_servicios,
    costo_total,
    costo_por_ton: costo_total,
    costo_recibido_arrastre:  0,
    costo_total_arrastrado:   costo_total,
    costo_por_ton_arrastrado: costo_total,
    calc_total_id: totalId,
  };
}
