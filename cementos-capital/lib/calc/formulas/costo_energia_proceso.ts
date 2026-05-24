// Costo de energía eléctrica por tonelada de proceso.
// El precio efectivo del kWh es la suma de tres componentes que el Excel
// reporta por separado en la sección "Energía".
//
// expresion: kwh_ton × (precio_contrato + precio_restricciones + cargos_fijos)
// unidad:    COP/Ton

import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

export const codigo = "COSTO_ENERGIA_PROCESO_v1";
export const nombre = "Costo Energía Eléctrica por Proceso";
export const expresion = "kwh_ton * (precio_contrato + precio_restricciones + cargos_fijos)";
export const parametros = [
  { nombre: "kwh_ton",              tipo: "number" as const, unidad: "kWh/Ton",  descripcion: "Consumo eléctrico por tonelada producida" },
  { nombre: "precio_contrato",      tipo: "number" as const, unidad: "COP/kWh",  descripcion: "Precio bajo contrato" },
  { nombre: "precio_restricciones", tipo: "number" as const, unidad: "COP/kWh",  descripcion: "Restricciones / costos de conexión" },
  { nombre: "cargos_fijos",         tipo: "number" as const, unidad: "COP/kWh",  descripcion: "Cargos fijos y administrativos" },
] as const;
export const retorno_unidad = "COP/Ton";

export const fn = (p: FormulaParams): FormulaResult => {
  const kwh   = new Decimal(p.kwh_ton);
  const cont  = new Decimal(p.precio_contrato);
  const restr = new Decimal(p.precio_restricciones);
  const fijo  = new Decimal(p.cargos_fijos);
  const precioKwh = cont.plus(restr).plus(fijo);
  const valor = kwh.times(precioKwh);

  return {
    valor: valor.toNumber(),
    expresion_evaluada:
      `${kwh} × (${cont} + ${restr} + ${fijo}) = ${kwh} × ${precioKwh} = ${valor.toFixed(4)}`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
