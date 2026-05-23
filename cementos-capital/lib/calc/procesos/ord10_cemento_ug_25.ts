// ORD 10 — Cemento UG 25 kg empacado
// Receta esperada: CEM_UG (pct=1.0, arrastre ORD 6) + SACO_25KG (40/ton) + CARGUE_CEM (pct=1.0).

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CEM_UG: 6,
};

export class Ord10CementoUg25 implements ProcesoCalculator {
  ord = 10;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD10",
      productoNombre: "Cemento UG 25 kg",
      calculoTipoMp: "costo_proceso_empaque_ug_25",
      conceptoMp: "Costo Granel + Empaque — Cemento UG 25 kg",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
