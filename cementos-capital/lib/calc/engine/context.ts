// Tipos del motor de cálculo

import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Client = SupabaseClient<Database>;
export type Periodo = string;       // YYYY-MM-01
export type UUID = string;

// ─────────────────────────────────────────────────────────────────
// Contexto de ejecución: datos cargados para la versión
// ─────────────────────────────────────────────────────────────────

export interface PrecioCtx {
  material_id: UUID;
  proveedor: string | null;
  periodo: Periodo;
  precio: number;
  unidad: string;
}

export interface PctConsumoCtx {
  material_id: UUID;
  proveedor: string;
  periodo: Periodo;
  porcentaje: number;
}

export interface RecetaCtx {
  receta_id: UUID;
  producto_id: UUID;
  proceso_id: UUID;
  periodo: Periodo;
  lineas: Array<{ material_id: UUID; porcentaje: number; orden: number | null }>;
}

export interface MaterialMeta {
  id: UUID;
  codigo: string;
  nombre: string;
  unidad_base: string;
}

export interface ProcesoMeta {
  id: UUID;
  ord: number;
  material: string;
  nombre: string;
  orden_topologico: number;
}

export interface CalcContext {
  versionId: UUID;
  runId: UUID;
  periodos: Periodo[];
  procesos: ProcesoMeta[];
  materialesById: Map<UUID, MaterialMeta>;
  materialesByCodigo: Map<string, MaterialMeta>;
  preciosByMatPeriodo: Map<string, PrecioCtx>;       // key: `${material_id}|${periodo}|${proveedor??''}`
  pctConsumoByKey: Map<string, PctConsumoCtx>;       // key: `${material_id}|${periodo}|${proveedor}`
  recetasByProcesoPeriodo: Map<string, RecetaCtx>;   // key: `${proceso_id}|${periodo}`
  formulaIdByCodigo: Map<string, UUID>;              // codigo (e.g. COSTO_PREHOMO_v1) → formula_definitions.id
  // Resultados previos: para que un proceso pueda referenciar costo_por_ton de un proceso anterior
  costoProcesoByKey: Map<string, { costo_total: number; costo_por_ton: number; calc_total_id: UUID }>; // key: `${proceso_id}|${periodo}`
}

// ─────────────────────────────────────────────────────────────────
// Entrada a registrar en calculation_log
// ─────────────────────────────────────────────────────────────────

export interface CalcLogEntry {
  calculo_tipo: string;
  proceso_id?: UUID | null;
  material_id?: UUID | null;
  clase_costo_id?: UUID | null;
  periodo: Periodo;
  concepto: string;
  valor_resultado: number;
  unidad?: string | null;
  formula_codigo: string;                    // se convierte a formula_id en el writer
  formula_expresion: string;
  parametros_entrada: Record<string, unknown>;
  nivel_jerarquia?: number;
  depende_de?: UUID[];                       // ids de calculation_log entries previos
  rol_dependencias?: Record<string, string>; // calculo_id → rol semántico (ej "precio_caliza_martillo")
}

export interface ProcesoResult {
  proceso_id: UUID;
  periodo: Periodo;
  costo_materia_prima: number | null;
  costo_combustible: number | null;
  costo_energia: number | null;
  costo_repuestos: number | null;
  costo_servicios: number | null;
  costo_total: number;
  costo_por_ton: number;
  costo_recibido_arrastre: number;
  costo_total_arrastrado: number;
  costo_por_ton_arrastrado: number;
  // ID del log entry "raíz" (costo total) para trazabilidad
  calc_total_id: UUID;
}

// Interfaz que cada implementación de proceso debe cumplir
export interface ProcesoCalculator {
  ord: number;
  /** Calcula UN periodo de UN proceso, escribe en calculation_log via writer, retorna resumen. */
  run(args: {
    ctx: CalcContext;
    proceso: ProcesoMeta;
    periodo: Periodo;
    writer: CalcWriter;
  }): Promise<ProcesoResult>;
}

// Writer abstrae la persistencia (permite testear con mock)
export interface CalcWriter {
  /** Escribe una entrada en calculation_log; retorna el id generado. */
  log(entry: CalcLogEntry): Promise<UUID>;
  /** Escribe el resumen costo_proceso. */
  writeCostoProceso(r: ProcesoResult, versionId: UUID, runId: UUID): Promise<void>;
}
