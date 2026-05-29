// ORD 16 — Fibrocemento
// Receta: Clinker (ORD 5) como insumo derivado + materiales directos.
// Confirmado en Excel: la fila es "Clinker En Cemento Fibro", no CEM_UG.

import { runRecetaProcess } from "./_receta_base";
import type {
  CalcContext, CalcWriter, Periodo, ProcesoCalculator, ProcesoMeta, ProcesoResult,
} from "@/lib/calc/engine/context";

const DERIVED_BY_CODIGO: Record<string, number> = {
  CLINKER001: 5,
  CALIZATRI:  2,
};

export class Ord16Fibrocemento implements ProcesoCalculator {
  ord = 16;

  async run(args: { ctx: CalcContext; proceso: ProcesoMeta; periodo: Periodo; writer: CalcWriter }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD16",
      productoNombre: "Fibrocemento",
      calculoTipoMp: "costo_proceso_fibrocemento",
      conceptoMp: "Costo Materiales — Fibrocemento",
      derivedByCodigo: DERIVED_BY_CODIGO,
      conEnergia: true,
      energiaKey: "fibrocemento",
      conCostosFijos: true,
      clasificar: true,
      registrarPlaceholders: true,
    });
  }
}
