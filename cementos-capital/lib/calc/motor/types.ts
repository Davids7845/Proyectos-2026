// Motor de fórmulas — tipos compartidos (versión de producción).
// Replica la cadena Datos → Base → TD → Costo del Excel.

export type UnidadCalculo =
  | "receta_humedad"  // Cantidad = Producción × Receta% × (1+Humedad)
  | "por_ton"         // Cantidad = Producción × 1 (repuestos/servicios; precio ya COP/Ton)
  | "energia"         // Cantidad = Producción × kWh/Ton; precio COP/kWh
  | "sacos"           // Cantidad = Producción × sacos/Ton; precio COP/saco
  | "cascada"         // Valor heredado del proceso origen
  | "placeholder";    // Sin valor (aporte = 0)

export interface RecetaComponente {
  material_codigo: string;
  tipo: string;
  orden_visual?: number;
  es_cascada: boolean;
  ord_origen: number | null;
  receta_pct: number;
  precio: number | null;
  flete: number;
  humedad: number;
  unidad_calculo: UnidadCalculo;
}

export interface Movimiento {
  material_codigo: string;
  tipo: string;
  cantidad: number;
  /** Valor total COP. null para cascadas (resuelto en el reporte de costo). */
  valor: number | null;
  es_cascada: boolean;
  ord_origen: number | null;
  consumo_unitario: number;
}

export interface AporteTipo {
  tipo: string;
  consumo_unitario: number;  // Ton/Ton, kWh/Ton o sacos/Ton según el componente
  aporte_por_ton: number;    // COP/Ton
  es_cascada: boolean;
}

export interface ResultadoCosto {
  desglose: AporteTipo[];
  total: number;             // COP/Ton
}
