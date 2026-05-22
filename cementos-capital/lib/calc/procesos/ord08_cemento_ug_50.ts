// ORD 8 — Cemento UG 50 kg empacado
//
// Receta de empaque (pct se interpreta como "unidades de input por tonelada de output"):
//   CEM_UG       pct=1.0    arrastrado de ORD 6 (1 ton granel por ton empacada)
//   SACO_50KG    pct=20     20 sacos por tonelada (1000/50)
//   CARGUE_CEM   pct=1.0    servicio empaque-cargue, COP/Ton
//
// La fórmula COSTO_MP_RECETA_v1 multiplica pct × precio sin importar la semántica,
// así que el mismo helper funciona aquí.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_UG: 6,
};

export class Ord08CementoUg50 implements ProcesoCalculator {
  ord = 8;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD8",
      productoNombre: "Cemento UG 50 kg",
      calculoTipoMp: "costo_proceso_empaque_ug_50",
      conceptoMp: "Costo Granel + Empaque — Cemento UG 50 kg",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
