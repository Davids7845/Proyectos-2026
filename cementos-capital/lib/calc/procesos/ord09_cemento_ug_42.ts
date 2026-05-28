// ORD 9 — Cemento UG 42,5 kg empacado
// Recipe: CEM_UG (ORD 6) + SACO_42_5KG (23.53/ton = 1000/42.5) + CARGUE_CEM

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord09CementoUg42 implements ProcesoCalculator {
  ord = 9;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD9",
      productoNombre: "Cemento UG 42,5 kg",
      calculoTipoMp: "costo_proceso_empaque_ug_42",
      conceptoMp: "Costo Granel + Empaque — Cemento UG 42,5 kg",
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      sacoCodigo: "SACO_42_5KG",
      sacosPorTon: 1000 / 42.5,
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
