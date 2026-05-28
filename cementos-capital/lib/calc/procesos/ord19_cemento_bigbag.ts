// ORD 19 — Cemento Big Bag 1,5 Toneladas
// Recipe: CEM_UG (ORD 6) + optional CARGUE_CEM service
// Big Bag packaging material not seeded; cost contribution added when available.

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord19CementoBigBag implements ProcesoCalculator {
  ord = 19;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD19",
      productoNombre: "Cemento Big Bag 1,5 T",
      calculoTipoMp: "costo_proceso_empaque_bigbag",
      conceptoMp: "Costo Granel + Empaque — Big Bag 1,5 T",
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
