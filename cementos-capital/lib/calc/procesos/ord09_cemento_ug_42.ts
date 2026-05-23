// ORD 9 — Cemento UG 42,5 kg empacado
// Receta esperada: CEM_UG (pct=1.0, arrastre ORD 6) + SACO_42_5KG (≈23.53/ton) + CARGUE_CEM (pct=1.0).

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

export class Ord09CementoUg42 implements ProcesoCalculator {
  ord = 9;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD9",
      productoNombre: "Cemento UG 42,5 kg",
      calculoTipoMp: "costo_proceso_empaque_ug_42",
      conceptoMp: "Costo Granel + Empaque — Cemento UG 42,5 kg",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
