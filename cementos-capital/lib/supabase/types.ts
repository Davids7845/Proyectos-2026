// Generado manualmente — reemplazar con: supabase gen types typescript --linked > lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      budget_versions: {
        Row: {
          id: string;
          nombre: string;
          descripcion: string | null;
          estado: "borrador" | "calculando" | "calculado" | "congelado" | "archivado";
          sap_enabled: boolean;
          precios_fijos: boolean;
          periodo_inicio: string;
          periodo_fin: string;
          creado_por: string | null;
          creado_en: string;
          modificado_en: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          descripcion?: string | null;
          estado?: "borrador" | "calculando" | "calculado" | "congelado" | "archivado";
          sap_enabled?: boolean;
          precios_fijos?: boolean;
          periodo_inicio: string;
          periodo_fin: string;
          creado_por?: string | null;
          creado_en?: string;
          modificado_en?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          descripcion?: string | null;
          estado?: "borrador" | "calculando" | "calculado" | "congelado" | "archivado";
          sap_enabled?: boolean;
          precios_fijos?: boolean;
          periodo_inicio?: string;
          periodo_fin?: string;
          creado_por?: string | null;
          modificado_en?: string;
        };
        Relationships: [];
      };
      procesos: {
        Row: {
          id: string;
          ord: number;
          material: string;
          nombre: string;
          orden_topologico: number;
          activo: boolean;
        };
        Insert: {
          id?: string;
          ord: number;
          material: string;
          nombre: string;
          orden_topologico: number;
          activo?: boolean;
        };
        Update: {
          id?: string;
          ord?: number;
          material?: string;
          nombre?: string;
          orden_topologico?: number;
          activo?: boolean;
        };
        Relationships: [];
      };
      materiales: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          unidad_base: string;
          categoria: string | null;
          tipo_insumo: string | null;
          humedad_default: string;
          activo: boolean;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          unidad_base: string;
          categoria?: string | null;
          tipo_insumo?: string | null;
          humedad_default?: string;
          activo?: boolean;
        };
        Update: {
          id?: string;
          codigo?: string;
          nombre?: string;
          unidad_base?: string;
          categoria?: string | null;
          tipo_insumo?: string | null;
          humedad_default?: string;
          activo?: boolean;
        };
        Relationships: [];
      };
      clases_costo: {
        Row: {
          id: string;
          codigo: string;
          denominacion: string;
          tipo: string | null;
          cuenta_contrapartida: string | null;
          denominacion_contrapartida: string | null;
        };
        Insert: {
          id?: string;
          codigo: string;
          denominacion: string;
          tipo?: string | null;
          cuenta_contrapartida?: string | null;
          denominacion_contrapartida?: string | null;
        };
        Update: {
          id?: string;
          codigo?: string;
          denominacion?: string;
          tipo?: string | null;
          cuenta_contrapartida?: string | null;
          denominacion_contrapartida?: string | null;
        };
        Relationships: [];
      };
      maestro_sap: {
        Row: {
          id: string;
          clase_costo_id: string;
          material_id: string;
          material_alt_id: string | null;
          proceso_id: string;
          tipo_insumo: string | null;
          orden_sap: string | null;
          clasificacion: string | null;
        };
        Insert: {
          id?: string;
          clase_costo_id: string;
          material_id: string;
          material_alt_id?: string | null;
          proceso_id: string;
          tipo_insumo?: string | null;
          orden_sap?: string | null;
          clasificacion?: string | null;
        };
        Update: {
          id?: string;
          clase_costo_id?: string;
          material_id?: string;
          material_alt_id?: string | null;
          proceso_id?: string;
          tipo_insumo?: string | null;
          orden_sap?: string | null;
          clasificacion?: string | null;
        };
        Relationships: [];
      };
      precios_insumos: {
        Row: {
          id: string;
          version_id: string;
          material_id: string;
          proveedor: string | null;
          periodo: string;
          precio_unitario: string;
          unidad: string;
          moneda: string;
          observaciones: string | null;
          creado_en: string;
          creado_por: string | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          material_id: string;
          proveedor?: string | null;
          periodo: string;
          precio_unitario: string;
          unidad: string;
          moneda?: string;
          observaciones?: string | null;
          creado_en?: string;
          creado_por?: string | null;
        };
        Update: {
          id?: string;
          version_id?: string;
          material_id?: string;
          proveedor?: string | null;
          periodo?: string;
          precio_unitario?: string;
          unidad?: string;
          moneda?: string;
          observaciones?: string | null;
        };
        Relationships: [];
      };
      porcentajes_consumo: {
        Row: {
          id: string;
          version_id: string;
          material_id: string;
          proveedor: string;
          periodo: string;
          porcentaje: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          material_id: string;
          proveedor: string;
          periodo: string;
          porcentaje: string;
        };
        Update: {
          id?: string;
          version_id?: string;
          material_id?: string;
          proveedor?: string;
          periodo?: string;
          porcentaje?: string;
        };
        Relationships: [];
      };
      recetas: {
        Row: {
          id: string;
          version_id: string;
          producto_id: string;
          proceso_id: string;
          periodo: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          producto_id: string;
          proceso_id: string;
          periodo: string;
        };
        Update: {
          id?: string;
          version_id?: string;
          producto_id?: string;
          proceso_id?: string;
          periodo?: string;
        };
        Relationships: [];
      };
      receta_lineas: {
        Row: {
          id: string;
          receta_id: string;
          material_id: string;
          porcentaje: string;
          orden: number | null;
        };
        Insert: {
          id?: string;
          receta_id: string;
          material_id: string;
          porcentaje: string;
          orden?: number | null;
        };
        Update: {
          id?: string;
          receta_id?: string;
          material_id?: string;
          porcentaje?: string;
          orden?: number | null;
        };
        Relationships: [];
      };
      humedades: {
        Row: {
          id: string;
          version_id: string;
          material_id: string;
          periodo: string;
          porcentaje: string;
        };
        Insert: {
          id?: string;
          version_id: string;
          material_id: string;
          periodo: string;
          porcentaje: string;
        };
        Update: {
          id?: string;
          version_id?: string;
          material_id?: string;
          periodo?: string;
          porcentaje?: string;
        };
        Relationships: [];
      };
      rendimientos: {
        Row: {
          id: string;
          version_id: string;
          proceso_id: string;
          periodo: string;
          horas_mes: number | null;
          produccion_ton: string | null;
          horas_operacion_efectivas: string | null;
          rendimiento_ton_hr: string | null;
          mro_ton_hr: string | null;
          dias_paro_programado: number;
          dias_paro_no_programado: number;
          disponibilidad: string | null;
          utilizacion: string | null;
          oee: string | null;
          mtbf_mantenimiento: string | null;
          mtbf_total: string | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          proceso_id: string;
          periodo: string;
          horas_mes?: number | null;
          produccion_ton?: string | null;
          horas_operacion_efectivas?: string | null;
          rendimiento_ton_hr?: string | null;
          mro_ton_hr?: string | null;
          dias_paro_programado?: number;
          dias_paro_no_programado?: number;
          disponibilidad?: string | null;
          utilizacion?: string | null;
          oee?: string | null;
          mtbf_mantenimiento?: string | null;
          mtbf_total?: string | null;
        };
        Update: {
          id?: string;
          version_id?: string;
          proceso_id?: string;
          periodo?: string;
          horas_mes?: number | null;
          produccion_ton?: string | null;
          horas_operacion_efectivas?: string | null;
          rendimiento_ton_hr?: string | null;
          mro_ton_hr?: string | null;
          dias_paro_programado?: number;
          dias_paro_no_programado?: number;
        };
        Relationships: [];
      };
      ventas_proyectadas: {
        Row: {
          id: string;
          version_id: string;
          material_id: string;
          presentacion: string | null;
          periodo: string;
          cantidad_ton: string;
          precio_venta: string | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          material_id: string;
          presentacion?: string | null;
          periodo: string;
          cantidad_ton: string;
          precio_venta?: string | null;
        };
        Update: {
          id?: string;
          version_id?: string;
          material_id?: string;
          presentacion?: string | null;
          periodo?: string;
          cantidad_ton?: string;
          precio_venta?: string | null;
        };
        Relationships: [];
      };
      parametros_energia: {
        Row: {
          id: string;
          version_id: string;
          periodo: string;
          precio_contrato: string | null;
          precio_restricciones: string | null;
          cargos_fijos: string | null;
          kwh_ton_proceso: Json | null;
          pci_combustibles: Json | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          periodo: string;
          precio_contrato?: string | null;
          precio_restricciones?: string | null;
          cargos_fijos?: string | null;
          kwh_ton_proceso?: Json | null;
          pci_combustibles?: Json | null;
        };
        Update: {
          id?: string;
          version_id?: string;
          periodo?: string;
          precio_contrato?: string | null;
          precio_restricciones?: string | null;
          cargos_fijos?: string | null;
          kwh_ton_proceso?: Json | null;
          pci_combustibles?: Json | null;
        };
        Relationships: [];
      };
      calculation_runs: {
        Row: {
          id: string;
          version_id: string;
          iniciado_en: string;
          finalizado_en: string | null;
          estado: "corriendo" | "exitoso" | "error";
          iniciado_por: string | null;
          duracion_ms: number | null;
          total_calculos: number | null;
          error_msg: string | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          iniciado_en?: string;
          finalizado_en?: string | null;
          estado?: "corriendo" | "exitoso" | "error";
          iniciado_por?: string | null;
          duracion_ms?: number | null;
          total_calculos?: number | null;
          error_msg?: string | null;
        };
        Update: {
          id?: string;
          version_id?: string;
          finalizado_en?: string | null;
          estado?: "corriendo" | "exitoso" | "error";
          duracion_ms?: number | null;
          total_calculos?: number | null;
          error_msg?: string | null;
        };
        Relationships: [];
      };
      calculation_log: {
        Row: {
          id: string;
          run_id: string;
          version_id: string;
          calculo_tipo: string;
          proceso_id: string | null;
          material_id: string | null;
          clase_costo_id: string | null;
          periodo: string;
          concepto: string;
          valor_resultado: string;
          unidad: string | null;
          formula_id: string;
          formula_expresion: string;
          parametros_entrada: Json;
          padre_id: string | null;
          nivel_jerarquia: number;
          es_override: boolean;
          valor_original: string | null;
          motivo_override: string | null;
          calculado_en: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          version_id: string;
          calculo_tipo: string;
          proceso_id?: string | null;
          material_id?: string | null;
          clase_costo_id?: string | null;
          periodo: string;
          concepto: string;
          valor_resultado: string;
          unidad?: string | null;
          formula_id: string;
          formula_expresion: string;
          parametros_entrada: Json;
          padre_id?: string | null;
          nivel_jerarquia?: number;
          es_override?: boolean;
          valor_original?: string | null;
          motivo_override?: string | null;
          calculado_en?: string;
        };
        Update: {
          id?: string;
          concepto?: string;
          valor_resultado?: string;
          es_override?: boolean;
          valor_original?: string | null;
          motivo_override?: string | null;
        };
        Relationships: [];
      };
      calculation_log_deps: {
        Row: {
          calculo_id: string;
          depende_de_id: string;
          rol_parametro: string | null;
        };
        Insert: {
          calculo_id: string;
          depende_de_id: string;
          rol_parametro?: string | null;
        };
        Update: {
          rol_parametro?: string | null;
        };
        Relationships: [];
      };
      costo_proceso: {
        Row: {
          id: string;
          version_id: string;
          run_id: string;
          proceso_id: string;
          periodo: string;
          costo_materia_prima: string | null;
          costo_combustible: string | null;
          costo_energia: string | null;
          costo_repuestos: string | null;
          costo_servicios: string | null;
          costo_total: string | null;
          costo_por_ton: string | null;
          costo_recibido_arrastre: string | null;
          costo_total_arrastrado: string | null;
          costo_por_ton_arrastrado: string | null;
          calc_total_id: string | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          run_id: string;
          proceso_id: string;
          periodo: string;
          costo_materia_prima?: string | null;
          costo_combustible?: string | null;
          costo_energia?: string | null;
          costo_repuestos?: string | null;
          costo_servicios?: string | null;
          costo_total?: string | null;
          costo_por_ton?: string | null;
          costo_recibido_arrastre?: string | null;
          costo_total_arrastrado?: string | null;
          costo_por_ton_arrastrado?: string | null;
          calc_total_id?: string | null;
        };
        Update: {
          id?: string;
          costo_materia_prima?: string | null;
          costo_combustible?: string | null;
          costo_energia?: string | null;
          costo_repuestos?: string | null;
          costo_servicios?: string | null;
          costo_total?: string | null;
          costo_por_ton?: string | null;
          costo_recibido_arrastre?: string | null;
          costo_total_arrastrado?: string | null;
          costo_por_ton_arrastrado?: string | null;
          calc_total_id?: string | null;
        };
        Relationships: [];
      };
      formula_definitions: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          expresion: string;
          parametros: Json;
          retorno_unidad: string | null;
          version: number;
          version_anterior_id: string | null;
          activa: boolean;
          creado_en: string;
          creado_por: string | null;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          descripcion?: string | null;
          expresion: string;
          parametros: Json;
          retorno_unidad?: string | null;
          version?: number;
          version_anterior_id?: string | null;
          activa?: boolean;
          creado_en?: string;
          creado_por?: string | null;
        };
        Update: {
          id?: string;
          codigo?: string;
          nombre?: string;
          descripcion?: string | null;
          expresion?: string;
          parametros?: Json;
          retorno_unidad?: string | null;
          activa?: boolean;
        };
        Relationships: [];
      };
      formula_dependencies: {
        Row: {
          formula_id: string;
          depende_de_id: string;
          tipo_dependencia: "directa" | "acumulada" | "proporcional";
        };
        Insert: {
          formula_id: string;
          depende_de_id: string;
          tipo_dependencia: "directa" | "acumulada" | "proporcional";
        };
        Update: {
          tipo_dependencia?: "directa" | "acumulada" | "proporcional";
        };
        Relationships: [];
      };
      movimientos_contables: {
        Row: {
          id: string;
          version_id: string;
          run_id: string | null;
          periodo: string;
          clase_costo_id: string | null;
          material_id: string | null;
          proceso_id: string | null;
          orden_sap: string | null;
          centro_costo: string | null;
          tipo_movimiento: string | null;
          valor_monetario: string | null;
          cantidad: string | null;
          unidad: string | null;
          traslado_desde: string | null;
          traslado_hasta: string | null;
          calc_id: string | null;
          texto_breve: string | null;
        };
        Insert: {
          id?: string;
          version_id: string;
          run_id?: string | null;
          periodo: string;
          clase_costo_id?: string | null;
          material_id?: string | null;
          proceso_id?: string | null;
          orden_sap?: string | null;
          centro_costo?: string | null;
          tipo_movimiento?: string | null;
          valor_monetario?: string | null;
          cantidad?: string | null;
          unidad?: string | null;
          traslado_desde?: string | null;
          traslado_hasta?: string | null;
          calc_id?: string | null;
          texto_breve?: string | null;
        };
        Update: {
          id?: string;
          valor_monetario?: string | null;
          cantidad?: string | null;
          texto_breve?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
