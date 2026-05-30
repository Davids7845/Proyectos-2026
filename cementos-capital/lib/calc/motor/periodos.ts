// Conversión entre el período-índice del motor nuevo (1, 2, 3…) y la fecha
// "YYYY-MM-01" que usa la UI vieja (costo_proceso) y formatMes().
// El motor indexa los períodos desde 1 a partir de budget_versions.fecha_inicio.

/** Índice de período (1-based) → fecha "YYYY-MM-01" relativa a fecha_inicio. */
export function periodoIndexToFecha(fechaInicio: string, index: number): string {
  const base = new Date(`${fechaInicio.slice(0, 10)}T00:00:00Z`);
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + (index - 1), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Fecha "YYYY-MM-01" → índice de período (1-based) relativo a fecha_inicio. */
export function fechaToPeriodoIndex(fechaInicio: string, fecha: string): number {
  const base = new Date(`${fechaInicio.slice(0, 10)}T00:00:00Z`);
  const f = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  return (f.getUTCFullYear() - base.getUTCFullYear()) * 12
    + (f.getUTCMonth() - base.getUTCMonth()) + 1;
}

/** Número de períodos entre fecha_inicio y fecha_fin (ambos inclusive). */
export function contarPeriodos(fechaInicio: string, fechaFin: string): number {
  const i = new Date(`${fechaInicio.slice(0, 10)}T00:00:00Z`);
  const f = new Date(`${fechaFin.slice(0, 10)}T00:00:00Z`);
  return (f.getUTCFullYear() - i.getUTCFullYear()) * 12
    + (f.getUTCMonth() - i.getUTCMonth()) + 1;
}
