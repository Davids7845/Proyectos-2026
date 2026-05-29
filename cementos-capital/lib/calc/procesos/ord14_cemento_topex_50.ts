// ORD 14 — Cemento Topex 50 kg empacado
// Decisión usuario (Fase 3): Topex cascadea de Cemento UG (ORD 6), NO de ART.
// Recipe: CEM_UG (ORD 6) + SACO_50_TPX (20/ton + rotura) + CARGUE_CEM + Energía

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
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      sacoCodigo: "SACO_50_TPX",
      sacosPorTon: 20,
      serviceCodigo: "CARGUE_CEM",
      conEnergia: true,
    });
  }
}
