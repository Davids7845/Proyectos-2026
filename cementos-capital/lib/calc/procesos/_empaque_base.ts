// Shared logic for packaging processes (ORD 8, 9, 10, 11, 14, 15, 19).
//
// These processes don't require an Excel receta — the recipe is physically fixed:
//   1 ton granel cement  (derived cost from upstream process)
//   N sacos per ton      (price from precios_insumos)
//   1 empaque service    (price from precios_insumos, optional)
//
// Using a hardcoded recipe avoids dependency on the Excel "Receta" section
// which typically omits packaging rows.

import { fn as calcMpReceta } from "@/lib/calc/formulas/costo_mp_receta";
import { logComponentesAuxiliares, produccionNormalizada, writeMovimientosMp } from "./_componentes_proceso";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoMeta,
  ProcesoResult,
  UUID,
} from "@/lib/calc/engine/context";

export interface RunEmpaqueOpts {
  errPrefix: string;
  productoNombre: string;
  calculoTipoMp: string;
  conceptoMp: string;
  /** ORD of the upstream granel process. */
  granelOrd: number;
  /** Material code of the granel bulk cement (e.g. "CEM_UG", "CEM_ART"). */
  granelCodigo: string;
  /** Material code of the saco. Omit for bulk/granel dispatch. */
  sacoCodigo?: string;
  /** Sacos per ton (physical constant: 1000 / saco_kg). Required when sacoCodigo given. */
  sacosPorTon?: number;
  /** Material code of the service (e.g. "CARGUE_CEM"). Optional. */
  serviceCodigo?: string;
  /**
   * Fase 3: si true, suma el costo de energía eléctrica del proceso (cuarto
   * componente del empaque / tercero del granel). Se obtiene vía el helper
   * común `logComponentesAuxiliares`; si no hay datos de energía, no contribuye.
   */
  conEnergia?: boolean;
  /** Clave para resolver el consumo eléctrico en `kwh_ton_proceso`. */
  energiaKey?: string;
}

export async function runEmpaqueProcess(
  args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter },
  opts: RunEmpaqueOpts,
): Promise<ProcesoResult> {
  const { ctx, proceso, periodo, writer } = args;
  const { errPrefix, granelOrd, granelCodigo } = opts;

  // ─── 1. Granel: derived from upstream process ─────────────────────────────
  const granelProductor = ctx.procesos.find(p => p.ord === granelOrd);
  if (!granelProductor) throw new Error(`${errPrefix} ${periodo}: proceso ORD ${granelOrd} no encontrado`);
  const granelResult = ctx.costoProcesoByKey.get(`${granelProductor.id}|${periodo}`);
  if (!granelResult) throw new Error(`${errPrefix} ${periodo}: ORD ${granelOrd} aún no calculado`);

  const granelMat = ctx.materialesByCodigo.get(granelCodigo);
  if (!granelMat) throw new Error(`${errPrefix} ${periodo}: material ${granelCodigo} no en contexto`);

  const granelPrecio = granelResult.costo_por_ton;
  const granelId = await writer.log({
    calculo_tipo: "precio_componente_derivado",
    proceso_id: proceso.id,
    material_id: granelMat.id,
    periodo,
    concepto: `Precio ${granelMat.nombre} (arrastrado de ORD ${granelOrd})`,
    valor_resultado: granelPrecio,
    unidad: "COP/Ton",
    formula_codigo: "COSTO_PROCESO_SUMA_v1",
    formula_expresion: `precio = costo_por_ton ORD ${granelOrd} = ${granelPrecio}`,
    parametros_entrada: { costo_arrastrado: granelPrecio },
    nivel_jerarquia: 2,
    depende_de: [granelResult.calc_total_id],
    rol_dependencias: { [granelResult.calc_total_id]: "costo_arrastrado" },
  });

  interface Comp { codigo: string; nombre: string; pct: number; precio: number; id: UUID }
  const componentes: Comp[] = [
    { codigo: granelCodigo, nombre: granelMat.nombre, pct: 1.0, precio: granelPrecio, id: granelId },
  ];

  // ─── 2. Saco ───────────────────────────────────────────────────────────────
  if (opts.sacoCodigo && opts.sacosPorTon != null) {
    const sacoMat = ctx.materialesByCodigo.get(opts.sacoCodigo);
    // Skip silently if the packaging material isn't seeded yet (e.g. Big Bag container)
    if (sacoMat) {
    const sacoP = ctx.preciosByMatPeriodo.get(`${sacoMat.id}|${periodo}|`);
    if (!sacoP) throw new Error(`${errPrefix} ${periodo}: falta precio para ${opts.sacoCodigo}`);
    // Fase 3: aplicar rotura de sacos — las unidades por ton se inflan por
    // (1 + rotura) para cubrir los sacos rotos en empaque (ej 20 → 20.4 @ 2%).
    const rotura = ctx.roturaSacos ?? 0.02;
    const sacosEfectivos = opts.sacosPorTon * (1 + rotura);
    const sacoId = await writer.log({
      calculo_tipo: "precio_componente_directo",
      proceso_id: proceso.id,
      material_id: sacoMat.id,
      periodo,
      concepto: `Precio ${sacoMat.nombre}`,
      valor_resultado: sacoP.precio,
      unidad: "COP/UN",
      formula_codigo: "COSTO_PROCESO_SUMA_v1",
      formula_expresion: `precio = ${sacoP.precio} (precios_insumos)`,
      parametros_entrada: { precio_directo: sacoP.precio, sacos_por_ton: opts.sacosPorTon, rotura, sacos_efectivos: sacosEfectivos },
      nivel_jerarquia: 2,
    });
    componentes.push({ codigo: opts.sacoCodigo, nombre: sacoMat.nombre, pct: sacosEfectivos, precio: sacoP.precio, id: sacoId });
    }   // end if sacoMat
  }   // end if sacoCodigo

  // ─── 3. Service (empaque / cargue) ────────────────────────────────────────
  if (opts.serviceCodigo) {
    const servMat = ctx.materialesByCodigo.get(opts.serviceCodigo);
    if (servMat) {
      const servP = ctx.preciosByMatPeriodo.get(`${servMat.id}|${periodo}|`);
      if (servP) {
        const servId = await writer.log({
          calculo_tipo: "precio_componente_directo",
          proceso_id: proceso.id,
          material_id: servMat.id,
          periodo,
          concepto: `Precio ${servMat.nombre}`,
          valor_resultado: servP.precio,
          unidad: "COP/Ton",
          formula_codigo: "COSTO_PROCESO_SUMA_v1",
          formula_expresion: `precio = ${servP.precio} (precios_insumos)`,
          parametros_entrada: { precio_directo: servP.precio },
          nivel_jerarquia: 2,
        });
        componentes.push({ codigo: opts.serviceCodigo, nombre: servMat.nombre, pct: 1.0, precio: servP.precio, id: servId });
      }
    }
  }

  // ─── 4. MP total (COSTO_MP_RECETA_v1) ─────────────────────────────────────
  const items = componentes.map(c => ({ codigo: c.codigo, nombre: c.nombre, pct: c.pct }));
  const mpParams: Record<string, number | string> = { items_json: JSON.stringify(items) };
  for (const c of componentes) mpParams[`precio_${c.codigo}`] = c.precio;
  const mpResult = calcMpReceta(mpParams);

  const rolDeps: Record<string, string> = {};
  for (const c of componentes) rolDeps[c.id] = `precio_${c.codigo}`;

  const mpId = await writer.log({
    calculo_tipo: opts.calculoTipoMp,
    proceso_id: proceso.id,
    periodo,
    concepto: opts.conceptoMp,
    valor_resultado: mpResult.valor,
    unidad: "COP/Ton",
    formula_codigo: "COSTO_MP_RECETA_v1",
    formula_expresion: mpResult.expresion_evaluada,
    parametros_entrada: mpParams,
    nivel_jerarquia: 1,
    depende_de: componentes.map(c => c.id),
    rol_dependencias: rolDeps,
  });

  // ─── Capa de agregación: movimientos de MP (granel + saco + servicio) ─────
  const produccion = produccionNormalizada(ctx, proceso.id, periodo);
  await writeMovimientosMp(
    { ctx, proceso, periodo, writer },
    produccion,
    componentes.map(c => ({ codigo: c.codigo, nombre: c.nombre, pct: c.pct, precio: c.precio })),
  );

  // ─── 5. Energía eléctrica (Fase 3) ────────────────────────────────────────
  // Cuarto componente del empaque (tercero del granel). Vía el helper común;
  // si no hay datos de energía para el proceso, no contribuye (costo_energia=null).
  let costo_energia: number | null = null;
  const totalDeps: UUID[] = [mpId];
  const totalRolDeps: Record<string, string> = { [mpId]: "costo_mp" };
  if (opts.conEnergia) {
    const aux = await logComponentesAuxiliares(
      { ctx, proceso, periodo, writer },
      { conEnergia: true, energiaKey: opts.energiaKey, conCostosFijos: false,
        movimientos: { produccion } },
    );
    if (aux.costo_energia != null && aux.energiaCalcId != null) {
      costo_energia = aux.costo_energia;
      totalDeps.push(aux.energiaCalcId);
      totalRolDeps[aux.energiaCalcId] = "costo_energia";
    }
  }

  // ─── 6. Total ──────────────────────────────────────────────────────────────
  const costoTotal = mpResult.valor + (costo_energia ?? 0);
  const totalId = await writer.log({
    calculo_tipo: "costo_proceso_total",
    proceso_id: proceso.id,
    periodo,
    concepto: `Costo total proceso — ${proceso.nombre}`,
    valor_resultado: costoTotal,
    unidad: "COP/Ton",
    formula_codigo: "COSTO_PROCESO_SUMA_v1",
    formula_expresion: `costo_mp=${mpResult.valor}${costo_energia != null ? ` + energia=${costo_energia}` : ""} → total=${costoTotal}`,
    parametros_entrada: { costo_mp: mpResult.valor, costo_energia: costo_energia ?? 0 },
    nivel_jerarquia: 0,
    depende_de: totalDeps,
    rol_dependencias: totalRolDeps,
  });

  return {
    proceso_id: proceso.id,
    periodo,
    costo_materia_prima: mpResult.valor,
    costo_combustible:   null,
    costo_energia,
    costo_repuestos:     null,
    costo_servicios:     null,
    costo_total:         costoTotal,
    costo_por_ton:       costoTotal,
    costo_recibido_arrastre:  0,
    costo_total_arrastrado:   costoTotal,
    costo_por_ton_arrastrado: costoTotal,
    calc_total_id: totalId,
  };
}
