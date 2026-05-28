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
      parametros_entrada: { precio_directo: sacoP.precio },
      nivel_jerarquia: 2,
    });
    componentes.push({ codigo: opts.sacoCodigo, nombre: sacoMat.nombre, pct: opts.sacosPorTon, precio: sacoP.precio, id: sacoId });
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

  // ─── 5. Total ──────────────────────────────────────────────────────────────
  const totalId = await writer.log({
    calculo_tipo: "costo_proceso_total",
    proceso_id: proceso.id,
    periodo,
    concepto: `Costo total proceso — ${proceso.nombre}`,
    valor_resultado: mpResult.valor,
    unidad: "COP/Ton",
    formula_codigo: "COSTO_PROCESO_SUMA_v1",
    formula_expresion: `costo_mp=${mpResult.valor} → total=${mpResult.valor}`,
    parametros_entrada: { costo_mp: mpResult.valor },
    nivel_jerarquia: 0,
    depende_de: [mpId],
    rol_dependencias: { [mpId]: "costo_mp" },
  });

  return {
    proceso_id: proceso.id,
    periodo,
    costo_materia_prima: mpResult.valor,
    costo_combustible:   null,
    costo_energia:       null,
    costo_repuestos:     null,
    costo_servicios:     null,
    costo_total:         mpResult.valor,
    costo_por_ton:       mpResult.valor,
    costo_recibido_arrastre:  0,
    costo_total_arrastrado:   mpResult.valor,
    costo_por_ton_arrastrado: mpResult.valor,
    calc_total_id: totalId,
  };
}
