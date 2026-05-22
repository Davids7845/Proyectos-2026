import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

// Fórmula raíz de un proceso: suma todos los valores numéricos en parametros_entrada.
// Permite que el override propague correctamente: al recalcular el total se vuelve a sumar
// con el valor actualizado del componente.

export const codigo = "COSTO_PROCESO_SUMA_v1";
export const nombre = "Suma de componentes de costo de un proceso";
export const expresion = "Σ todos los componentes (materia prima + combustible + energía + repuestos + servicios)";
export const parametros = [] as const; // dinámico — depende de qué componentes tenga el proceso
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  let total = new Decimal(0);
  const piezas: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== "number" && typeof v !== "string") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    total = total.plus(n);
    piezas.push(`${k}=${n}`);
  }
  return {
    valor: total.toNumber(),
    expresion_evaluada: `${piezas.join(" + ")} = ${total.toFixed(6)}`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
