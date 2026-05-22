import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

export const codigo = "COSTO_PREHOMO_v1";
export const nombre = "Costo unitario Mezcla Prehomo (Caliza + Arcilla)";
export const expresion =
  "(precio_caliza_martillo * pct_caliza) + (precio_arcilla * pct_arcilla)";
export const parametros = [
  { nombre: "precio_caliza_martillo", tipo: "number" as const, unidad: "COP/Ton", descripcion: "Precio Caliza + Martillo ponderado" },
  { nombre: "precio_arcilla",         tipo: "number" as const, unidad: "COP/Ton", descripcion: "Precio Arcilla Explotada" },
  { nombre: "pct_caliza",             tipo: "number" as const, unidad: "fracción", descripcion: "% Caliza en receta Prehomo" },
  { nombre: "pct_arcilla",            tipo: "number" as const, unidad: "fracción", descripcion: "% Arcilla en receta Prehomo" },
] as const;
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  const caliza  = new Decimal(p.precio_caliza_martillo);
  const arcilla = new Decimal(p.precio_arcilla);
  const pctC    = new Decimal(p.pct_caliza);
  const pctA    = new Decimal(p.pct_arcilla);

  const resultado = caliza.times(pctC).plus(arcilla.times(pctA));

  return {
    valor: resultado.toNumber(),
    expresion_evaluada: `(${caliza} × ${pctC}) + (${arcilla} × ${pctA}) = ${resultado.toFixed(6)}`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
