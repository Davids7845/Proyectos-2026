// ORD 12 — Cemento a Granel ART (despacho granel)
// No saco; recipe: CEM_ART (ORD 7) + optional CARGUE_CEM service

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord12CementoGranelArt implements ProcesoCalculator {
  ord = 12;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD12",
      productoNombre: "Cemento a Granel ART",
      calculoTipoMp: "costo_proceso_cemento_granel_art",
      conceptoMp: "Costo Granel + Despacho — Cemento a Granel ART",
      granelOrd: 7,
      granelCodigo: "CEM_ART",
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
