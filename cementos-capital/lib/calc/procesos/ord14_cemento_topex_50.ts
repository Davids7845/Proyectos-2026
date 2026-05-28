// ORD 14 — Cemento Topex 50 kg empacado
// Topex is an ART variant; recipe: CEM_ART (ORD 7) + SACO_50_TPX (20/ton) + CARGUE_CEM

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord14CementoTopex50 implements ProcesoCalculator {
  ord = 14;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD14",
      productoNombre: "Cemento Topex 50 kg",
      calculoTipoMp: "costo_proceso_empaque_topex_50",
      conceptoMp: "Costo Granel + Empaque — Cemento Topex 50 kg",
      granelOrd: 7,
      granelCodigo: "CEM_ART",
      sacoCodigo: "SACO_50_TPX",
      sacosPorTon: 20,
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
