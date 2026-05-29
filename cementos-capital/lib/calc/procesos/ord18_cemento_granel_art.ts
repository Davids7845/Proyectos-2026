// ORD 18 — Cemento Granel ART (despacho granel)
// No saco; recipe: CEM_ART (ORD 7) + CARGUE_CEM service + Energía

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord18CementoGranelArt implements ProcesoCalculator {
  ord = 18;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD18",
      productoNombre: "Cemento Granel ART",
      calculoTipoMp: "costo_proceso_cemento_granel_art",
      conceptoMp: "Costo Granel + Despacho — Cemento Granel ART",
      granelOrd: 7,
      granelCodigo: "CEM_ART",
      serviceCodigo: "CARGUE_CEM",
      conEnergia: true,
    });
  }
}
