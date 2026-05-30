// POC motor de fórmulas — tipos compartidos
// Replica la cadena Datos → Base → TD → Costo del Excel.

export type UnidadCalculo =
  | "receta_humedad"  // Cantidad = Producción × Receta% × (1+Humedad)
  | "por_ton"         // Cantidad = Producción × 1 (repuestos/servicios)
  | "energia"         // Cantidad = Producción × kWh/ton
  | "cascada"         // Valor heredado del proceso origen
  | "placeholder";    // Sin valor (aporte = 0)

export interface PocReceta {
  material_codigo: string;
  tipo: string;
  es_cascada: boolean;
  ord_origen: number | null;
  receta_pct: number;
  precio: number | null;
  flete: number;
  humedad: number;
  unidad_calculo: UnidadCalculo;
}

export interface PocMovimiento {
  material_codigo: string;
  tipo: string;
  cantidad: number;
  /** Valor total COP. null para cascadas (resuelto en el reporte). */
  valor: number | null;
  es_cascada: boolean;
  ord_origen: number | null;
  consumo_unitario: number;
}

export interface PocAporteTipo {
  tipo: string;
  consumo_unitario: number;  // Ton/Ton (o kWh/Ton para energía)
  aporte_por_ton: number;    // COP/Ton
}

export interface PocResultadoCosto {
  desglose: PocAporteTipo[];
  total: number;             // COP/Ton
}
