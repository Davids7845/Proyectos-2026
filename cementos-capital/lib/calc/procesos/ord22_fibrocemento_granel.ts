// ORD 22 — Fibrocemento Granel (despacho granel)
// No saco; recipe: FIBROCEMENTO (ORD 16) derived cost

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord22FibrocementoGranel implements ProcesoCalculator {
  ord = 22;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD22",
      productoNombre: "Fibrocemento Granel",
      calculoTipoMp: "costo_proceso_fibrocemento_granel",
      conceptoMp: "Costo Granel — Fibrocemento Granel",
      granelOrd: 16,
      granelCodigo: "FIBROCEMENTO",
    });
  }
}
