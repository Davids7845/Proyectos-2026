// Motor — Fase "Base": genera movimientos (= hoja Base del Excel).
// Fórmula verificada en la POC (reconcilió -0.24% vs Excel):
//   Cantidad = Producción × Receta% × (1 + Humedad)
//   Valor    = (Precio + Flete) × Cantidad
//   (cascadas: Valor = null, se resuelve en calcular_costo)

import type { RecetaComponente, Movimiento } from "./types";

export function generarMovimientos(
  produccion: number,
  recetas: RecetaComponente[],
): Movimiento[] {
  const movimientos: Movimiento[] = [];

  for (const r of recetas) {
    let cantidad = 0;
    let valor: number | null = null;
    let consumo_unitario = 0;

    switch (r.unidad_calculo) {
      case "receta_humedad":
        cantidad = produccion * r.receta_pct * (1 + r.humedad);
        valor = ((r.precio ?? 0) + r.flete) * cantidad;
        consumo_unitario = r.receta_pct * (1 + r.humedad);
        break;

      case "por_ton":
        cantidad = produccion;
        valor = (r.precio ?? 0) * cantidad;
        consumo_unitario = 1;
        break;

      case "energia":
        // receta_pct = kWh/Ton; precio = COP/kWh efectivo (hoja Costo ~525.15)
        cantidad = produccion * r.receta_pct;
        valor = (r.precio ?? 0) * cantidad;
        consumo_unitario = r.receta_pct;
        break;

      case "sacos":
        // receta_pct = sacos/Ton (con rotura ya aplicada); precio = COP/saco
        cantidad = produccion * r.receta_pct;
        valor = (r.precio ?? 0) * cantidad;
        consumo_unitario = r.receta_pct;
        break;

      case "cascada":
        cantidad = produccion * r.receta_pct;
        valor = null;
        consumo_unitario = r.receta_pct;
        break;

      case "placeholder":
        // Sin movimiento; sólo marcador "existe pero vale 0" para la UI.
        continue;
    }

    movimientos.push({
      material_codigo: r.material_codigo,
      tipo: r.tipo,
      cantidad,
      valor,
      es_cascada: r.es_cascada,
      ord_origen: r.ord_origen,
      consumo_unitario,
    });
  }

  // Movimiento de producción (salida, negativo) — fila "Producción" de la hoja Base
  movimientos.push({
    material_codigo: "PRODUCCION",
    tipo: "Producción",
    cantidad: -produccion,
    valor: null,
    es_cascada: false,
    ord_origen: null,
    consumo_unitario: 0,
  });

  return movimientos;
}

// Versión async para uso con Supabase DB
export async function generarMovimientosProceso(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  versionId: string,
  ord: number,
  periodo: number,
): Promise<void> {
  const { data: prodRow } = await supabase
    .from("produccion_proceso")
    .select("toneladas")
    .eq("version_id", versionId).eq("ord", ord).eq("periodo", periodo)
    .single();
  if (!prodRow) throw new Error(`Sin producción para ORD ${ord} período ${periodo}`);
  const produccion = Number(prodRow.toneladas);

  const { data: recetasRaw } = await supabase
    .from("receta_componentes")
    .select("*")
    .eq("version_id", versionId).eq("ord", ord).eq("periodo", periodo)
    .order("orden_visual");

  const recetas: RecetaComponente[] = (recetasRaw ?? []).map((r: Record<string, unknown>) => ({
    material_codigo: r.material_codigo as string,
    tipo: r.tipo as string,
    orden_visual: Number(r.orden_visual ?? 0),
    es_cascada: Boolean(r.es_cascada),
    ord_origen: r.ord_origen as number | null,
    receta_pct: Number(r.receta_pct),
    precio: r.precio != null ? Number(r.precio) : null,
    flete: Number(r.flete ?? 0),
    humedad: Number(r.humedad ?? 0),
    unidad_calculo: r.unidad_calculo as RecetaComponente["unidad_calculo"],
  }));

  const movs = generarMovimientos(produccion, recetas);

  await supabase.from("movimientos_generados")
    .delete().eq("version_id", versionId).eq("ord", ord).eq("periodo", periodo);

  if (movs.length > 0) {
    await supabase.from("movimientos_generados").insert(
      movs.map(m => ({
        version_id: versionId, ord, periodo,
        material_codigo: m.material_codigo, tipo: m.tipo,
        cantidad: m.cantidad, valor: m.valor,
        es_cascada: m.es_cascada, ord_origen: m.ord_origen,
        consumo_unitario: m.consumo_unitario,
      }))
    );
  }
}
