// Costo de servicios industriales por tonelada producida.
// Estructura idéntica a repuestos; placeholder Fase 1.5.

import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

interface ServicioItem { codigo: string; cantidad: number; precio: number }

export const codigo = "COSTO_SERVICIOS_PROCESO_v1";
export const nombre = "Costo Servicios Industriales por Ton";
export const expresion = "sum_i( cantidad_i × precio_i ) / ton_producidas";
export const parametros = [
  { nombre: "items_json",      tipo: "string" as const, unidad: "JSON", descripcion: "Lista de servicios" },
  { nombre: "ton_producidas",  tipo: "number" as const, unidad: "Ton",  descripcion: "Producción del periodo" },
] as const;
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  const items = JSON.parse(String(p.items_json)) as ServicioItem[];
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
