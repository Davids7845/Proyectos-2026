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

export interface ParametrosEnergiaCtx {
  periodo: Periodo;
  precio_contrato: number | null;
  precio_restricciones: number | null;
  cargos_fijos: number | null;
  kwh_ton_proceso: Record<string, number> | null;   // codigo o nombre de proceso → kWh/Ton
  pci_combustibles: Record<string, number> | null;  // proveedor → Kcal/Ton
  kcal_tck_total: number | null;
  pci_ponderado_horno: number | null;
  composicion_horno: Record<string, number> | null; // componente → fracción 0..1
  // ── Modelo térmico horno (Fase 1.6) ───────────────────────────────
  kcal_tck:                number | null;  // Kcal/Tck del horno (fila 428 "Prueba PCI")
  pct_energia_carbones:    number | null;  // fracción 0..1 (fila 411)
  pct_energia_alternos:    number | null;  // fila 410
  pct_energia_diesel:      number | null;  // fila 409
  pci_ponderado_carbones:  number | null;  // Kcal/kg ponderado por masa Mixto/Bituminoso
  pci_ponderado_alternos:  number | null;  // Kcal/kg ponderado por CDR/TDF
  pci_ponderado_diesel:    number | null;  // Kcal/kg Diesel (fila 412)
}

/**
 * Costo fijo / repuestos / servicios industriales por proceso y periodo.
 * Cada item ya viene normalizado a COP/Ton (calculado fuera del motor en Fase 1.6:
 * los valores se extraen directamente del Excel "Costo"; en Fase 2 se reconstruirán
 * desde `cantidad × precio / producción` con su propia trazabilidad).
 */
export interface CostoFijoCtx {
  codigo:        string;  // identificador estable, p.ej. "BARRAS_PLAC_TRIT"
  nombre:        string;  // etiqueta humana (Excel)
  costo_por_ton: number;  // COP/Ton
}

export interface RendimientoCtx {
  proceso_id: UUID;
  periodo: Periodo;
  horas_mes: number | null;
  produccion_ton: number | null;
  horas_operacion_efectivas: number | null;
  rendimiento_ton_hr: number | null;
  disponibilidad: number | null;
  utilizacion: number | null;
  oee: number | null;
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
  // Fase 1.5: contexto energético y de rendimiento (opcional para compat con tests)
  parametrosEnergiaByPeriodo?: Map<Periodo, ParametrosEnergiaCtx>;
  rendimientosByProcesoPeriodo?: Map<string, RendimientoCtx>;  // key: `${proceso_id}|${periodo}`
  // Fase 1.6.2: costos fijos por proceso (repuestos + servicios + regalías + otros consumibles)
  costosFijosByProcesoPeriodo?: Map<string, CostoFijoCtx[]>;   // key: `${proceso_id}|${periodo}`
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
