// Motor — Fase "Costo": agrega movimientos por tipo y resuelve cascadas.
//   consumo_unitario = Cantidad_componente / Producción
//   aporte_por_ton   = Valor_componente / Producción
//   cascada          = consumo_unitario × costo_total_proceso_origen

import type { Movimiento, ResultadoCosto, AporteTipo } from "./types";

export function calcularCosto(
  movimientos: Movimiento[],
  costosPorOrd: Map<number, number>, // ord → costo_total COP/Ton del proceso origen
): ResultadoCosto {
  const produccionMov = movimientos.find(m => m.tipo === "Producción");
  if (!produccionMov) throw new Error("Movimiento de producción no encontrado");
  const produccion = Math.abs(produccionMov.cantidad);

  // Agrupar por tipo (varias fuentes del mismo tipo se suman, ej. CORRHIERR+CALAMINA1)
  const porTipo = new Map<string, {
    cantidad_total: number;
    valor_total: number;
    es_cascada: boolean;
    ord_origen: number | null;
  }>();

  for (const m of movimientos) {
    if (m.tipo === "Producción") continue;
    const prev = porTipo.get(m.tipo) ?? {
      cantidad_total: 0, valor_total: 0,
      es_cascada: m.es_cascada, ord_origen: m.ord_origen,
    };
    prev.cantidad_total += m.cantidad;
    prev.valor_total += m.valor ?? 0;
    // si cualquier fuente del tipo es cascada, mantener flag y ord_origen
    if (m.es_cascada) { prev.es_cascada = true; prev.ord_origen = m.ord_origen; }
    porTipo.set(m.tipo, prev);
  }

  const desglose: AporteTipo[] = [];
  let total = 0;

  for (const [tipo, datos] of Array.from(porTipo.entries())) {
    const consumo_unitario = datos.cantidad_total / produccion;
    let aporte_por_ton = 0;

    if (datos.es_cascada) {
      const costoOrigen = costosPorOrd.get(datos.ord_origen!);
      if (costoOrigen == null) {
        throw new Error(`Costo del proceso origen (ORD ${datos.ord_origen}) no disponible para cascada "${tipo}"`);
      }
      aporte_por_ton = consumo_unitario * costoOrigen;
    } else {
      aporte_por_ton = datos.valor_total / produccion;
    }

    desglose.push({ tipo, consumo_unitario, aporte_por_ton, es_cascada: datos.es_cascada });
    total += aporte_por_ton;
  }

  return { desglose, total };
}

// Versión async para uso con Supabase DB
export async function calcularCostoProceso(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  versionId: string,
  ord: number,
  periodo: number,
): Promise<number> {
  const { data: movsRaw } = await supabase
    .from("movimientos_generados")
    .select("*")
    .eq("version_id", versionId).eq("ord", ord).eq("periodo", periodo);

  const movimientos: Movimiento[] = (movsRaw ?? []).map((m: Record<string, unknown>) => ({
    material_codigo: m.material_codigo as string,
    tipo: m.tipo as string,
    cantidad: Number(m.cantidad),
    valor: m.valor != null ? Number(m.valor) : null,
    es_cascada: Boolean(m.es_cascada),
    ord_origen: m.ord_origen as number | null,
    consumo_unitario: Number(m.consumo_unitario),
  }));

  // Cargar costos de los procesos origen (cascadas)
  const costosPorOrd = new Map<number, number>();
  const ordsOrigen = Array.from(new Set(
    movimientos.filter(m => m.es_cascada && m.ord_origen != null).map(m => m.ord_origen!)
  ));
  for (const ordOrigen of ordsOrigen) {
    const { data: costoRow } = await supabase
      .from("costo_calculado")
      .select("aporte_por_ton")
      .eq("version_id", versionId).eq("ord", ordOrigen).eq("periodo", periodo)
      .eq("es_total", true).single();
    if (costoRow) costosPorOrd.set(ordOrigen, Number(costoRow.aporte_por_ton));
  }

  const resultado = calcularCosto(movimientos, costosPorOrd);

  await supabase.from("costo_calculado")
    .delete().eq("version_id", versionId).eq("ord", ord).eq("periodo", periodo);

  const rows = resultado.desglose.map((d, i) => ({
    version_id: versionId, ord, periodo,
    tipo: d.tipo, orden_visual: i,
    consumo_unitario: d.consumo_unitario,
    // precio unitario implícito = aporte / consumo (COP por unidad de consumo).
    costo_unitario: d.consumo_unitario !== 0 ? d.aporte_por_ton / d.consumo_unitario : null,
    aporte_por_ton: d.aporte_por_ton,
    es_total: false, es_cascada: d.es_cascada,
  }));
  rows.push({
    version_id: versionId, ord, periodo,
    tipo: "TOTAL", orden_visual: 999,
    consumo_unitario: 0,
    costo_unitario: null,
    aporte_por_ton: resultado.total,
    es_total: true, es_cascada: false,
  });
  await supabase.from("costo_calculado").insert(rows);

  return resultado.total;
}
