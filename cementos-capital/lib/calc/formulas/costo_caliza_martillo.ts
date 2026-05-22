import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

// Fórmula Excel fila 3 hoja Datos:
// Row3 = Row4 * pct_caliza + (Row4 + Row6) * pct_martillo
// donde pct_caliza y pct_martillo vienen del % Consumo (rows 129-130).
// Para Sep-Dic 2025 los % son None en el Excel → se usa 0.9/0.1 implícito.
// Desde Ene-2026 el Excel usa 0.95/0.05.
export const codigo = "COSTO_CALIZA_MARTILLO_v1";
export const nombre = "Precio Caliza + Martillo ponderado por % Consumo";
export const expresion =
  "(precio_caliza * pct_caliza) + ((precio_caliza + costo_martillo) * pct_martillo)";
export const parametros = [
  { nombre: "precio_caliza",   tipo: "number" as const, unidad: "COP/Ton",  descripcion: "Precio Caliza Explotada (fila 4 Datos)" },
  { nombre: "costo_martillo",  tipo: "number" as const, unidad: "COP/Ton",  descripcion: "Costo Adicional Martillo (fila 6 Datos)" },
  { nombre: "pct_caliza",      tipo: "number" as const, unidad: "fracción", descripcion: "% de caliza en mezcla (fila 129 % Consumo)" },
  { nombre: "pct_martillo",    tipo: "number" as const, unidad: "fracción", descripcion: "% de martillo en mezcla (fila 130 % Consumo)" },
] as const;
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  const caliza    = new Decimal(p.precio_caliza);
  const martillo  = new Decimal(p.costo_martillo);
  const pctC      = new Decimal(p.pct_caliza);
  const pctM      = new Decimal(p.pct_martillo);

  const resultado = caliza.times(pctC).plus(caliza.plus(martillo).times(pctM));

  return {
    valor: resultado.toNumber(),
    expresion_evaluada:
      `(${caliza} × ${pctC}) + ((${caliza} + ${martillo}) × ${pctM}) = ${resultado.toFixed(6)}`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
