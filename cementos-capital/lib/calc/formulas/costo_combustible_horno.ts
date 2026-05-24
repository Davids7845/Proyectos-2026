// Costo de combustible térmico por tonelada de clinker.
// Modelo simplificado: cada combustible contribuye con (kg_ton × precio).
// items_json: [{ codigo, kg_ton, precio }]

import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

interface CombustibleItem { codigo: string; kg_ton: number; precio: number }

export const codigo = "COSTO_COMBUSTIBLE_HORNO_v1";
export const nombre = "Costo Combustibles Horno por Ton de Clinker";
export const expresion = "sum_i( kg_ton_i × precio_i )";
export const parametros = [
  { nombre: "items_json", tipo: "string" as const, unidad: "JSON", descripcion: "Lista de combustibles con kg/ton y precio" },
] as const;
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  const items = JSON.parse(String(p.items_json)) as CombustibleItem[];
  let acc = new Decimal(0);
  const parts: string[] = [];
  for (const it of items) {
    const kg = new Decimal(it.kg_ton);
    const pr = new Decimal(it.precio);
    const sub = kg.times(pr);
    acc = acc.plus(sub);
    parts.push(`${it.codigo}: ${kg}×${pr}=${sub.toFixed(2)}`);
  }
  return {
    valor: acc.toNumber(),
    expresion_evaluada: parts.length > 0 ? `${parts.join(" + ")} = ${acc.toFixed(4)}` : `(sin combustibles) = 0`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
