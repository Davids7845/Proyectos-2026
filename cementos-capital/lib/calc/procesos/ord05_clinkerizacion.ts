// ORD 5 — Clinkerización (producto: CLINKER)
// Receta: HARINACRUD (arrastre ORD 3) + CARBONMOL (arrastre ORD 4) + directos.

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
  HARINACRUD: 3,
  CARBONMOL:  4,
  COMBALT:   20, // combustibles alternos (ORD 20) — si aparece en la receta
};

export class Ord05Clinkerizacion implements ProcesoCalculator {
  ord = 5;

  async run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult> {
    return runRecetaProcess(args, {
      errPrefix: "ORD5",
      productoNombre: "Clinker",
      calculoTipoMp: "costo_mp_clinker",
      conceptoMp: "Costo Materia Prima — Clinker",
      derivedByCodigo: DERIVED_BY_CODIGO,
    });
  }
}
