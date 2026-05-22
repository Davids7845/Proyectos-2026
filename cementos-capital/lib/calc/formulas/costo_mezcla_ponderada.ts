import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

// Fórmula genérica para mezclas ponderadas:
//   resultado = Σ (precio_i × pct_i)
//
// Para serializar en parametros_entrada usamos JSON.stringify de la lista de items.
// Acepta dos formas:
//   1) precios_json = '[{"nombre":"...","precio":1234,"pct":0.5}, ...]'
//   2) componentes individuales precio_X y pct_X (no recomendado; se prefiere 1)

export const codigo = "COSTO_MEZCLA_PONDERADA_v1";
export const nombre = "Costo ponderado por mezcla (Σ precio_i × pct_i)";
export const expresion = "sum(precio_i * pct_i) para cada componente en la mezcla";
export const parametros = [
  { nombre: "items_json", tipo: "string" as const, descripcion: "JSON array de {nombre, precio, pct}" },
] as const;
export const retorno_unidad = "COP/Ton";

interface Item { nombre: string; precio: number; pct: number; }

export const fn = (p: FormulaParams): FormulaResult => {
  const raw = String(p.items_json ?? "[]");
  const items = JSON.parse(raw) as Item[];

  let total = new Decimal(0);
  const piezas: string[] = [];
  for (const it of items) {
    const aporte = new Decimal(it.precio).times(it.pct);
    total = total.plus(aporte);
    piezas.push(`(${it.precio} × ${it.pct})`);
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
