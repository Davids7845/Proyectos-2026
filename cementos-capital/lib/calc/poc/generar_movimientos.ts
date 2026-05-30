// POC motor — Fase "Base": genera movimientos (= hoja Base del Excel).
// Fórmula verificada celda-a-celda:
//   Cantidad = Producción × Receta% × (1 + Humedad)
//   Valor    = (Precio + Flete) × Cantidad
//   (cascadas: Valor = null, se resuelve en calcular_costo)

import type { PocReceta, PocMovimiento } from "./types";

export function generarMovimientos(
  produccion: number,
  recetas: PocReceta[],
): PocMovimiento[] {
  const movimientos: PocMovimiento[] = [];

  for (const r of recetas) {
    let cantidad = 0;
    let valor: number | null = null;
    let consumo_unitario = 0;

    switch (r.unidad_calculo) {
      case "receta_humedad":
        // Cantidad = Producción × Receta% × (1 + Humedad)
        cantidad = produccion * r.receta_pct * (1 + r.humedad);
        valor = ((r.precio ?? 0) + r.flete) * cantidad;
        consumo_unitario = r.receta_pct * (1 + r.humedad);
        break;

      case "por_ton":
        // Repuestos/servicios: precio es COP/Ton directo
        cantidad = produccion;
        valor = (r.precio ?? 0) * cantidad;
        consumo_unitario = 1;
        break;

      case "energia":
        // receta_pct = kWh/Ton; precio = COP/kWh efectivo
        cantidad = produccion * r.receta_pct;
        valor = (r.precio ?? 0) * cantidad;
        consumo_unitario = r.receta_pct; // kWh/Ton
        break;

      case "cascada":
        // Consumo físico sí se calcula; valor se resuelve en el reporte
        cantidad = produccion * r.receta_pct;
        valor = null;
        consumo_unitario = r.receta_pct;
        break;

      case "placeholder":
        // Sin movimiento: el placeholder es sólo un marcador de "existe pero vale 0".
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

  // Movimiento de producción (salida, negativo) — espejo de la fila "Producción" en Base
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
    .from("poc_produccion")
    .select("toneladas")
    .eq("version_id", versionId)
    .eq("ord", ord)
    .eq("periodo", periodo)
    .single();
  const produccion = Number(prodRow.toneladas);

  const { data: recetasRaw } = await supabase
    .from("poc_recetas")
    .select("*")
    .eq("version_id", versionId)
    .eq("ord", ord)
    .eq("periodo", periodo);

  const recetas: PocReceta[] = (recetasRaw ?? []).map((r: Record<string, unknown>) => ({
    material_codigo: r.material_codigo as string,
    tipo: r.tipo as string,
    es_cascada: Boolean(r.es_cascada),
    ord_origen: r.ord_origen as number | null,
    receta_pct: Number(r.receta_pct),
    precio: r.precio != null ? Number(r.precio) : null,
    flete: Number(r.flete ?? 0),
    humedad: Number(r.humedad ?? 0),
    unidad_calculo: r.unidad_calculo as PocReceta["unidad_calculo"],
  }));

  const movs = generarMovimientos(produccion, recetas);

  // Limpiar movimientos previos para este ord/periodo
  await supabase.from("poc_movimientos")
    .delete()
    .eq("version_id", versionId)
    .eq("ord", ord)
    .eq("periodo", periodo);

  for (const m of movs) {
    await supabase.from("poc_movimientos").insert({
      version_id: versionId, ord, periodo,
      material_codigo: m.material_codigo,
      tipo: m.tipo,
      cantidad: m.cantidad,
      valor: m.valor,
      es_cascada: m.es_cascada,
      ord_origen: m.ord_origen,
      consumo_unitario: m.consumo_unitario,
    });
  }
}
