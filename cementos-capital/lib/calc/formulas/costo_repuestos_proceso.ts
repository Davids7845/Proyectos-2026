// Costo de repuestos por tonelada producida.
// Placeholder Fase 1.5: la lista detallada de repuestos viene en Fase 2.
// items_json: [{ codigo, cantidad, precio }], ton_producidas: scalar.

import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

interface RepItem { codigo: string; cantidad: number; precio: number }

export const codigo = "COSTO_REPUESTOS_PROCESO_v1";
export const nombre = "Costo Repuestos por Ton";
export const expresion = "sum_i( cantidad_i × precio_i ) / ton_producidas";
export const parametros = [
  { nombre: "items_json",      tipo: "string" as const, unidad: "JSON", descripcion: "Lista de repuestos" },
  { nombre: "ton_producidas",  tipo: "number" as const, unidad: "Ton",  descripcion: "Producción del periodo" },
] as const;
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  const items = JSON.parse(String(p.items_json)) as RepItem[];
  const ton = new Decimal(p.ton_producidas);
  if (ton.lte(0)) {
    return { valor: 0, expresion_evaluada: `ton_producidas <= 0 → 0`, parametros_snapshot: p };
  }
  let acc = new Decimal(0);
  for (const it of items) acc = acc.plus(new Decimal(it.cantidad).times(it.precio));
  const valor = acc.div(ton);
  return {
    valor: valor.toNumber(),
    expresion_evaluada: `${acc.toFixed(2)} / ${ton} = ${valor.toFixed(4)}`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
