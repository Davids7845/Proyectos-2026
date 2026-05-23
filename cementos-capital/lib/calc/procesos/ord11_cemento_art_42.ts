// ORD 11 — Cemento ART 42,5 kg empacado
// Receta esperada: CEM_ART (pct=1.0, arrastre ORD 7) + SACO_42_5KG + CARGUE_CEM.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_ART: 7,
};

export class Ord11CementoArt42 implements ProcesoCalculator {
  ord = 11;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD11",
      productoNombre: "Cemento ART 42,5 kg",
      calculoTipoMp: "costo_proceso_empaque_art_42",
      conceptoMp: "Costo Granel + Empaque — Cemento ART 42,5 kg",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
