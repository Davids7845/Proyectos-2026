// ORD 15 — Cemento UG TP (transporte propio / granel en camión)
// Sin saco; receta: CEM_UG (arrastre ORD 6) + CARGUE_CK (servicio cargue) + otros.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_UG: 6,
};

export class Ord15CementoUgTp implements ProcesoCalculator {
  ord = 15;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD15",
      productoNombre: "Cemento UG TP",
      calculoTipoMp: "costo_proceso_cemento_ug_tp",
      conceptoMp: "Costo Granel + Despacho — Cemento UG TP",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
