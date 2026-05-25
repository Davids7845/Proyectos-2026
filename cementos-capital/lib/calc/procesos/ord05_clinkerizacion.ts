// ORD 5 — Clinkerización (producto: CLINKER)
// Receta visible del Excel: sólo HARINACRUD (arrastre ORD 3).
// El consumo de CARBONMOL (ORD 4) y COMBALT (ORD 20) NO está en la sección
// Recetas — se calcula a partir del modelo térmico del horno:
//   consumo = (kcal_tck × pct_energia) / pci_ponderado / 1000
//
// Fase 1.6: agregamos esos dos componentes vía extraDerivedComponents.

import { runRecetaProcess } from "./_receta_base";
import { fn as calcConsumoCombustible } from "@/lib/calc/formulas/consumo_combustible_horno";
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
  COMBALT:   20,
};

function buildConsumoCalc(combustible: "carbones" | "alternos", material_codigo: string) {
  return (ctx: CalcContext, periodo: Periodo, proceso_id: string) => {
    // Fase 1.7: override de Excel Presupuesto (Costo!N63/N64) — valor pasteado
    // por usuario, no derivado del modelo térmico. Si existe, gana sobre la fórmula.
    const overrideKey = `${proceso_id}|${material_codigo}|${periodo}`;
    const override = ctx.consumoOverrideByKey?.get(overrideKey);
    if (override != null) {
      return {
        valor: override,
        formula_codigo: "CONSUMO_OVERRIDE_BUDGET_v1",
        formula_expresion: `override Excel Presupuesto (${material_codigo}): ${override} Ton/Ton`,
        parametros_entrada: { override, fuente: "Excel Costo!N63/N64" },
      };
    }

    const en = ctx.parametrosEnergiaByPeriodo?.get(periodo);
    if (!en) throw new Error(`ORD5 ${periodo}: faltan parámetros de energía (modelo térmico)`);
    const kcal_tck = en.kcal_tck;
    const pct = combustible === "carbones" ? en.pct_energia_carbones : en.pct_energia_alternos;
    const pci = combustible === "carbones" ? en.pci_ponderado_carbones : en.pci_ponderado_alternos;
    if (kcal_tck == null || pct == null || pci == null) {
      throw new Error(
        `ORD5 ${periodo}: faltan parámetros térmicos de ${combustible} `
        + `(kcal_tck=${kcal_tck}, pct_energia=${pct}, pci_ponderado=${pci})`
      );
    }
    const res = calcConsumoCombustible({ kcal_tck, pct_energia: pct, pci_ponderado: pci });
    return {
      valor: res.valor,
      formula_codigo: "CONSUMO_COMBUSTIBLE_HORNO_v1",
      formula_expresion: res.expresion_evaluada,
      parametros_entrada: { kcal_tck, pct_energia: pct, pci_ponderado: pci },
    };
  };
}

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
      conEnergia: true,
      energiaKey: "clinkerización",
      conCostosFijos: true,
      extraDerivedComponents: [
        {
          material_codigo: "CARBONMOL",
          productor_ord: 4,
          label: "Carbón Molido — térmico",
          consumo_calculator: buildConsumoCalc("carbones", "CARBONMOL"),
        },
        {
          material_codigo: "COMBALT",
          productor_ord: 20,
          label: "Combustibles Alternos — térmico",
          consumo_calculator: buildConsumoCalc("alternos", "COMBALT"),
        },
      ],
    });
  }
}
