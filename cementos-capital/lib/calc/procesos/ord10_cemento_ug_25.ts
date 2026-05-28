// ORD 10 — Cemento UG 25 kg empacado
// Recipe: CEM_UG (ORD 6) + SACO_25KG (40/ton = 1000/25) + CARGUE_CEM

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord10CementoUg25 implements ProcesoCalculator {
  ord = 10;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD10",
      productoNombre: "Cemento UG 25 kg",
      calculoTipoMp: "costo_proceso_empaque_ug_25",
      conceptoMp: "Costo Granel + Empaque — Cemento UG 25 kg",
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      sacoCodigo: "SACO_25KG",
      sacosPorTon: 40,
      serviceCodigo: "CARGUE_CEM",
    });
  }
}
