// ORD 7 — Cemento ART (granel)
// Receta típica: CLINKER (arrastre ORD 5) + Yeso + Caliza + adiciones específicas ART.

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
  CLINKER001: 5,
};

export class Ord07CementoArt implements ProcesoCalculator {
  ord = 7;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD7",
      productoNombre: "Cemento ART",
      calculoTipoMp: "costo_mp_cemento_art",
      conceptoMp: "Costo Materia Prima — Cemento ART",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
