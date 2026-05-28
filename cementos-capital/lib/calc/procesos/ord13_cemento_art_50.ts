// ORD 13 — Cemento ART 50 kg empacado
// Recipe: CEM_ART (ORD 7) + SACO_50KG (20/ton) + CARGUE_CEM

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord13CementoArt50 implements ProcesoCalculator {
  ord = 13;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD13",
      productoNombre: "Cemento ART 50 kg",
      calculoTipoMp: "costo_proceso_empaque_art_50",
      conceptoMp: "Costo Granel + Empaque — Cemento ART 50 kg",
      granelOrd: 7,
      granelCodigo: "CEM_ART",
      sacoCodigo: "SACO_50KG",
      sacosPorTon: 20,
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
