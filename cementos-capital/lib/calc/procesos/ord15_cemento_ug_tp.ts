// ORD 15 — Cemento UG TP (despacho granel transporte propio)
// No saco; recipe: CEM_UG (ORD 6) + optional CARGUE_CEM service

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord15CementoUgTp implements ProcesoCalculator {
  ord = 15;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD15",
      productoNombre: "Cemento UG TP",
      calculoTipoMp: "costo_proceso_cemento_ug_tp",
      conceptoMp: "Costo Granel + Despacho — Cemento UG TP",
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
