// Consumo pasteado desde el budget Excel (override directo, no derivado del modelo térmico).
// Se usa en ORD5 cuando el usuario provee el valor de consumo de combustible directamente
// (Excel Costo!N63 = carbones, Costo!N64 = alternos) en vez de calcularlo con la fórmula
// CONSUMO_COMBUSTIBLE_HORNO_v1. No tiene cálculo — la "expresión" es simplemente devolver
// el valor de entrada.

import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

export const codigo = "CONSUMO_OVERRIDE_BUDGET_v1";
export const nombre = "Consumo de combustible (override Excel Costo!N)";
export const expresion = "override";
export const parametros = [
  { nombre: "override", tipo: "number" as const, unidad: "Ton/Ton", descripcion: "Valor pasteado desde Excel Costo!N63/N64" },
  { nombre: "fuente",   tipo: "string" as const, unidad: "—",        descripcion: "Origen del valor" },
] as const;
export const retorno_unidad = "Ton combustible / Ton Clinker";

export const fn = (p: FormulaParams): FormulaResult => {
  const v = Number(p.override);
  return {
    valor: v,
    expresion_evaluada: `override Excel Presupuesto: ${v} Ton/Ton`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
