// ORD 11 — Cemento ART 42,5 kg empacado
// Recipe: CEM_ART (ORD 7) + SACO_42_ART (23.53/ton = 1000/42.5) + CARGUE_CEM

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord11CementoArt42 implements ProcesoCalculator {
  ord = 11;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD11",
      productoNombre: "Cemento ART 42,5 kg",
      calculoTipoMp: "costo_proceso_empaque_art_42",
      conceptoMp: "Costo Granel + Empaque — Cemento ART 42,5 kg",
      granelOrd: 7,
      granelCodigo: "CEM_ART",
      sacoCodigo: "SACO_42_ART",
      sacosPorTon: 1000 / 42.5,
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
