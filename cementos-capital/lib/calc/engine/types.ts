import type Decimal from "decimal.js";

export type FormulaParams = Record<string, number | string>;

export interface FormulaResult {
  valor: number;
  expresion_evaluada: string;
  parametros_snapshot: FormulaParams;
}

export type FormulaFn = (p: FormulaParams) => FormulaResult;

export interface FormulaDefinition {
  codigo: string;
  nombre: string;
  expresion: string;
  parametros: ReadonlyArray<{
    nombre: string;
    tipo: "number" | "string";
    unidad?: string;
    descripcion?: string;
  }>;
  retorno_unidad: string;
  fn: FormulaFn;
}

export interface CalculoInput {
  version_id: string;
  run_id: string;
  proceso_id?: string;
  material_id?: string;
  clase_costo_id?: string;
  periodo: string;
  concepto: string;
  formula_id: string;
  formula_expresion: string;
  parametros_entrada: FormulaParams;
  valor_resultado: Decimal;
  unidad?: string;
  padre_id?: string;
  nivel_jerarquia?: number;
  deps?: Array<{ depende_de_id: string; rol_parametro?: string }>;
}

export interface TopologicalNode {
  formulaId: string;
  codigo: string;
  dependencias: string[];
}
