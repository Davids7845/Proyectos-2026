// Motor — Orquestador: procesa los procesos en orden topológico para un período.
// Las cascadas exigen que el proceso origen se calcule ANTES que el dependiente.
//
// Orden topológico (spec Sección 2.6):
//   Nivel 0: ORD 1, 2, 4, 20
//   Nivel 1: ORD 3
//   Nivel 2: ORD 5
//   Nivel 3: ORD 6, 7, 16
//   Nivel 4: ORD 8, 9, 10, 11, 14, 17, 18, 22
//   Nivel 5: ORD 21 (vista derivada, no se calcula aquí)

import { generarMovimientos } from "./generar_movimientos";
import { calcularCosto } from "./calcular_costo";
import type { RecetaComponente, ResultadoCosto } from "./types";

/** Orden topológico de los procesos calculables (sin ORD 21). */
export const ORDEN_TOPOLOGICO: number[] = [
  // Nivel 0
  1, 2, 4, 20,
  // Nivel 1
  3,
  // Nivel 2
  5,
  // Nivel 3
  6, 7, 16,
  // Nivel 4
  8, 9, 10, 11, 14, 17, 18, 22,
];

export interface DatosProceso {
  ord: number;
  produccion: number;
  recetas: RecetaComponente[];
}

/**
 * Calcula todos los procesos de un período en memoria, respetando el orden
 * topológico para que las cascadas resuelvan contra costos ya calculados.
 * Devuelve un mapa ord → ResultadoCosto.
 */
export function calcularPeriodo(
  procesos: Map<number, DatosProceso>,
): Map<number, ResultadoCosto> {
  const resultados = new Map<number, ResultadoCosto>();
  const costosPorOrd = new Map<number, number>(); // ord → total

  for (const ord of ORDEN_TOPOLOGICO) {
    const datos = procesos.get(ord);
    if (!datos) continue;
    const movimientos = generarMovimientos(datos.produccion, datos.recetas);
    const resultado = calcularCosto(movimientos, costosPorOrd);
    resultados.set(ord, resultado);
    costosPorOrd.set(ord, resultado.total);
  }

  return resultados;
}

// Versión async para Supabase: procesa el período completo en orden topológico.
// Devuelve la lista de procesos calculados (ord + total) para reporte.
export async function calcularPeriodoDB(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  versionId: string,
  periodo: number,
): Promise<Array<{ ord: number; total: number }>> {
  const { generarMovimientosProceso } = await import("./generar_movimientos");
  const { calcularCostoProceso } = await import("./calcular_costo");
  const calculados: Array<{ ord: number; total: number }> = [];
  for (const ord of ORDEN_TOPOLOGICO) {
    const { data: prod } = await supabase
      .from("produccion_proceso")
      .select("id")
      .eq("version_id", versionId).eq("ord", ord).eq("periodo", periodo)
      .maybeSingle();
    if (!prod) continue; // proceso sin datos este período → omitir
    await generarMovimientosProceso(supabase, versionId, ord, periodo);
    const total = await calcularCostoProceso(supabase, versionId, ord, periodo);
    calculados.push({ ord, total });
  }
  return calculados;
}
