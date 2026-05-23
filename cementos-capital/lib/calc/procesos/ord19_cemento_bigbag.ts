// ORD 19 — Cemento Big Bag 1,5 Toneladas
// Receta: CEM_UG (pct=1.0, arrastre ORD 6) + big-bag (pct≈0.667/ton) + CARGUE_CEM.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_UG: 6,
};

export class Ord19CementoBigBag implements ProcesoCalculator {
  ord = 19;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD19",
      productoNombre: "Cemento Big Bag 1,5 T",
      calculoTipoMp: "costo_proceso_empaque_bigbag",
      conceptoMp: "Costo Granel + Empaque — Big Bag 1,5 T",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
