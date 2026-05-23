// ORD 16 — Fibrocemento
// Receta: CEM_UG (arrastre ORD 6) + materiales fibrosos + aditivos (todos directos).
// El granel fuente se confirmará con el Excel real; mientras tanto asumimos CEM_UG.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_UG: 6,
};

export class Ord16Fibrocemento implements ProcesoCalculator {
  ord = 16;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD16",
      productoNombre: "Fibrocemento",
      calculoTipoMp: "costo_proceso_fibrocemento",
      conceptoMp: "Costo Materiales — Fibrocemento",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
