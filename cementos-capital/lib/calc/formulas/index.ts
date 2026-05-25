import type { FormulaDefinition } from "../engine/types";
import { definition as costoCalizaMartillo } from "./costo_caliza_martillo";
import { definition as costoPrehomo }        from "./costo_prehomo";
import { definition as costoMezclaPonderada } from "./costo_mezcla_ponderada";
import { definition as costoProcesoSuma } from "./costo_proceso_suma";
import { definition as costoMpReceta } from "./costo_mp_receta";
import { definition as costoEnergiaProceso }    from "./costo_energia_proceso";
import { definition as costoCombustibleHorno }  from "./costo_combustible_horno";
import { definition as costoRepuestosProceso }  from "./costo_repuestos_proceso";
import { definition as costoServiciosProceso }  from "./costo_servicios_proceso";
import { definition as consumoCombustibleHorno } from "./consumo_combustible_horno";
import { definition as consumoOverrideBudget }   from "./consumo_override_budget";

export const FORMULA_REGISTRY: Record<string, FormulaDefinition> = {
  [costoCalizaMartillo.codigo]:   costoCalizaMartillo,
  [costoPrehomo.codigo]:          costoPrehomo,
  [costoMezclaPonderada.codigo]:  costoMezclaPonderada,
  [costoProcesoSuma.codigo]:      costoProcesoSuma,
  [costoMpReceta.codigo]:         costoMpReceta,
  [costoEnergiaProceso.codigo]:   costoEnergiaProceso,
  [costoCombustibleHorno.codigo]: costoCombustibleHorno,
  [costoRepuestosProceso.codigo]: costoRepuestosProceso,
  [costoServiciosProceso.codigo]: costoServiciosProceso,
  [consumoCombustibleHorno.codigo]: consumoCombustibleHorno,
  [consumoOverrideBudget.codigo]:   consumoOverrideBudget,
};

export function getFormula(codigo: string): FormulaDefinition {
  const f = FORMULA_REGISTRY[codigo];
  if (!f) throw new Error(`Fórmula no registrada: ${codigo}`);
  return f;
}

export { costoCalizaMartillo, costoPrehomo, costoMezclaPonderada };
