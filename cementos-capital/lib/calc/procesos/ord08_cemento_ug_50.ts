// ORD 8 — Cemento UG 50 kg empacado
// Recipe (hardcoded — Excel template omits packaging rows):
//   CEM_UG    pct=1.0   granel from ORD 6
//   SACO_50KG pct=20    20 sacos/ton (1000/50)
//   CARGUE_CEM pct=1.0  service COP/Ton

import { runEmpaqueProcess } from "./_empaque_base";
import type {
  CalcContext,
  CalcWriter,
  Periodo,
  ProcesoCalculator,
  ProcesoMeta,
  ProcesoResult,
} from "@/lib/calc/engine/context";

export class Ord08CementoUg50 implements ProcesoCalculator {
  ord = 8;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runEmpaqueProcess(args, {
      errPrefix: "ORD8",
      productoNombre: "Cemento UG 50 kg",
      calculoTipoMp: "costo_proceso_empaque_ug_50",
      conceptoMp: "Costo Granel + Empaque — Cemento UG 50 kg",
      granelOrd: 6,
      granelCodigo: "CEM_UG",
      sacoCodigo: "SACO_50KG",
      sacosPorTon: 20,
      serviceCodigo: "CARGUE_CEM",
      conEnergia: true,
    });
  }
}
