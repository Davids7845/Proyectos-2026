// ORD 4 — Molienda de Carbón (producto: CARBÓN MOLIDO)
// Receta: blend de carbones (todos compras directas, sin arrastre).

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord04MoliendaCarbon implements ProcesoCalculator {
  ord = 4;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD4",
      productoNombre: "Carbón Molido",
      calculoTipoMp: "costo_mp_carbon",
      conceptoMp: "Costo Materia Prima — Carbón Molido",
      derivedByCodigo: {},
      conEnergia: true,
      energiaKey: "molienda de carbón",
      conCostosFijos: true,
    });
  }
}
