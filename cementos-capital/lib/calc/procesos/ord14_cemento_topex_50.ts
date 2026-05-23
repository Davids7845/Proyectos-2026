// ORD 14 — Cemento Topex 50 kg empacado
// Topex es una variante de ART; receta: CEM_ART (arrastre ORD 7) + SACO_50KG + CARGUE_CEM.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_ART: 7,
};

export class Ord14CementoTopex50 implements ProcesoCalculator {
  ord = 14;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD14",
      productoNombre: "Cemento Topex 50 kg",
      calculoTipoMp: "costo_proceso_empaque_topex_50",
      conceptoMp: "Costo Granel + Empaque — Cemento Topex 50 kg",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
