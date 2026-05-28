// ORD 20 — Combustibles Alternos (producto: COMBALT — costo blended de alternos)
//
// Todos los insumos son compras directas (CDR, TDF, BRIQUETAS, etc.).
// La receta define la proporción de cada combustible alterno para el periodo.
// El costo resultante es el precio ponderado por tonelada de mezcla alternativa.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord20CombustiblesAlternos implements ProcesoCalculator {
  ord = 20;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD20",
      productoNombre: "Combustibles Alternos",
      calculoTipoMp: "costo_mp_combustibles_alternos",
      conceptoMp: "Costo Materia Prima — Combustibles Alternos",
      derivedByCodigo: {}, // CDR, TDF, BRIQUETAS son todos compras directas
      conEnergia: true,
      energiaKey: "combustibles alternos",
      conCostosFijos: true,
    });
  }
}
