import type { FormulaDefinition } from "../engine/types";
import { definition as costoCalizaMartillo } from "./costo_caliza_martillo";
import { definition as costoPrehomo }        from "./costo_prehomo";
import { definition as costoMezclaPonderada } from "./costo_mezcla_ponderada";
import { definition as costoProcesoSuma } from "./costo_proceso_suma";

export const FORMULA_REGISTRY: Record<string, FormulaDefinition> = {
  [costoCalizaMartillo.codigo]: costoCalizaMartillo,
  [costoPrehomo.codigo]:        costoPrehomo,
  [costoMezclaPonderada.codigo]: costoMezclaPonderada,
  [costoProcesoSuma.codigo]:    costoProcesoSuma,
};

export function getFormula(codigo: string): FormulaDefinition {
  const f = FORMULA_REGISTRY[codigo];
  if (!f) throw new Error(`Fórmula no registrada: ${codigo}`);
  return f;
}

export { costoCalizaMartillo, costoPrehomo, costoMezclaPonderada };
