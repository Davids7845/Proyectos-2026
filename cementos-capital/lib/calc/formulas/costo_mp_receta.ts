import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

// Costo de materia prima a partir de una receta + precios por componente.
//
// Input:
//   items_json  = '[{"codigo":"MEZCPREHO","nombre":"Mezcla Prehomo","pct":0.96}, ...]'
//   precio_<codigo> = number   (un parámetro por cada item en items_json)
//
// Output: Σ pct_i × precio_<codigo_i>
//
// Diseño: usar el material `codigo` como sufijo del parámetro evita colisiones de nombres
// y permite que override propague vía rol_parametro = `precio_<codigo>`.

export const codigo = "COSTO_MP_RECETA_v1";
export const nombre = "Costo MP a partir de receta (Σ pct_i × precio_componente_i)";
export const expresion = "sum(items_json[i].pct × precio_<items_json[i].codigo>)";
export const parametros = [
  { nombre: "items_json", tipo: "string" as const, descripcion: "JSON array de {codigo, nombre, pct}" },
] as const;
export const retorno_unidad = "COP/Ton";

interface Item { codigo: string; nombre: string; pct: number; }

export const fn = (p: FormulaParams): FormulaResult => {
  const raw = String(p.items_json ?? "[]");
  const items = JSON.parse(raw) as Item[];

  let total = new Decimal(0);
  const piezas: string[] = [];
  for (const it of items) {
    const key = `precio_${it.codigo}`;
    const precioRaw = p[key];
    if (precioRaw == null) {
      throw new Error(`COSTO_MP_RECETA_v1: falta parámetro "${key}"`);
    }
    const precio = typeof precioRaw === "number" ? precioRaw : Number(precioRaw);
    if (!Number.isFinite(precio)) {
      throw new Error(`COSTO_MP_RECETA_v1: "${key}" no es finito (${precioRaw})`);
    }
    const aporte = new Decimal(precio).times(it.pct);
    total = total.plus(aporte);
    piezas.push(`(${it.nombre} ${precio} × ${it.pct})`);
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
