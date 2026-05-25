// Consumo de combustible (Ton/Ton de Clinker) requerido por el horno.
// El consumo se deriva del modelo térmico:
//
//   consumo = (kcal_tck × pct_energia) / pci_ponderado
//
// Donde:
//   kcal_tck       = Kcal/kg de Clinker que requiere el horno (en Excel "Tck")
//   pct_energia    = fracción 0..1 que ese combustible aporta al horno
//   pci_ponderado  = poder calorífico ponderado del combustible (kcal/kg)
//
// Las unidades se cancelan: (kcal/kg Ck × fracción) / (kcal/kg fuel) = kg/kg
// = Ton fuel / Ton Clinker.

import Decimal from "decimal.js";
import type { FormulaDefinition, FormulaParams, FormulaResult } from "../engine/types";

export const codigo = "CONSUMO_COMBUSTIBLE_HORNO_v1";
export const nombre = "Consumo de combustible por Ton de Clinker";
export const expresion = "(kcal_tck * pct_energia) / pci_ponderado";
export const parametros = [
  { nombre: "kcal_tck",      tipo: "number" as const, unidad: "kcal/kg Ck",  descripcion: "Kcal requeridas por kg de clinker (Tck)" },
  { nombre: "pct_energia",   tipo: "number" as const, unidad: "fracción",    descripcion: "Aporte energético del combustible" },
  { nombre: "pci_ponderado", tipo: "number" as const, unidad: "kcal/kg",     descripcion: "PCI ponderado del combustible" },
] as const;
export const retorno_unidad = "Ton combustible / Ton Clinker";

export const fn = (p: FormulaParams): FormulaResult => {
  const kcal = new Decimal(p.kcal_tck);
  const pct  = new Decimal(p.pct_energia);
  const pci  = new Decimal(p.pci_ponderado);
  if (pci.lte(0)) throw new Error("CONSUMO_COMBUSTIBLE_HORNO_v1: pci_ponderado debe ser > 0");
  const valor = kcal.times(pct).dividedBy(pci);

  return {
    valor: valor.toNumber(),
    expresion_evaluada:
      `(${kcal} × ${pct}) / ${pci} = ${valor.toFixed(8)}`,
    parametros_snapshot: p,
  };
};

export const definition: FormulaDefinition = {
  codigo, nombre, expresion, parametros, retorno_unidad, fn,
};
