// ORD 3 — Molienda de Crudo (producto: HARINA CRUDA)
// Receta: MEZCLA PREHOMO (arrastre ORD 1) + Hierro + Calamina.

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
  MEZCPREHO: 1,
};

export class Ord03MoliendaCrudo implements ProcesoCalculator {
  ord = 3;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD3",
      productoNombre: "Harina Cruda",
      calculoTipoMp: "costo_mp_crudo",
      conceptoMp: "Costo Materia Prima — Harina Cruda",
      derivedByCodigo: DERIVED_BY_CODIGO,
      conEnergia: true,
      energiaKey: "molienda de crudo",
    });
  }
}
