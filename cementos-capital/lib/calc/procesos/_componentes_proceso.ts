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
}

export interface AuxComponentesResult {
  costo_energia:   number | null;
  energiaCalcId:   UUID | null;
  costo_servicios: number | null;
  fijosCalcIds:    UUID[];
  fijosRolDeps:    Record<string, string>;
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
        }
      }
    }
  }

  // ── Costos fijos (repuestos, servicios, regalías, etc.) ───────────────────
  let costo_servicios: number | null = null;
  const fijosCalcIds: UUID[] = [];
  const fijosRolDeps: Record<string, string> = {};

  if (opts.conCostosFijos) {
    const items = ctx.costosFijosByProcesoPeriodo?.get(`${proceso.id}|${periodo}`) ?? [];
    let suma = 0;
    for (const it of items) {
      if (it.costo_por_ton === 0) continue;
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
    }
    if (suma > 0) costo_servicios = suma;
  }

  return { costo_energia, energiaCalcId, costo_servicios, fijosCalcIds, fijosRolDeps };
}
