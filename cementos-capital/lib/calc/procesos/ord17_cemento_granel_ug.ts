// ORD 17 — Cemento Granel UG (despacho granel)
// No saco; recipe: CEM_UG (ORD 6) + optional CARGUE_CEM service

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord17CementoGranelUg implements ProcesoCalculator {
  ord = 17;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD17",
      productoNombre: "Cemento Granel UG",
      calculoTipoMp: "costo_proceso_cemento_granel_ug",
      conceptoMp: "Costo Granel + Despacho — Cemento Granel UG",
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      serviceCodigo: "CARGUE_CEM",
      conEnergia: true,
    });
  }
}
