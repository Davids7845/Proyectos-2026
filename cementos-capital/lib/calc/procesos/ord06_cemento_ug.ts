// ORD 6 — Cemento UG (granel)
// Receta típica: CLINKER (arrastre ORD 5) + Yeso + Puzolana + Adit. molienda + Caliza.

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

export class Ord06CementoUg implements ProcesoCalculator {
  ord = 6;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD6",
      productoNombre: "Cemento UG",
      calculoTipoMp: "costo_mp_cemento_ug",
      conceptoMp: "Costo Materia Prima — Cemento UG",
      derivedByCodigo: DERIVED_BY_CODIGO,
      conEnergia: true,
      energiaKey: "cemento ug",
      conCostosFijos: true,
    });
  }
}
