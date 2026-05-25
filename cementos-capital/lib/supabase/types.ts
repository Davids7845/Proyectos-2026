export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budget_versions: {
        Row: {
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string
          id: string
          modificado_en: string
          nombre: string
          periodo_fin: string
          periodo_inicio: string
          precios_fijos: boolean
          sap_enabled: boolean
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          modificado_en?: string
          nombre: string
          periodo_fin: string
          periodo_inicio: string
          precios_fijos?: boolean
          sap_enabled?: boolean
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          modificado_en?: string
          nombre?: string
          periodo_fin?: string
          periodo_inicio?: string
          precios_fijos?: boolean
          sap_enabled?: boolean
        }
        Relationships: []
      }
      calculation_log: {
        Row: {
          calculado_en: string
          calculo_tipo: string
          clase_costo_id: string | null
          concepto: string
          es_override: boolean
          formula_expresion: string
          formula_id: string
          id: string
          material_id: string | null
          motivo_override: string | null
          nivel_jerarquia: number
          padre_id: string | null
          parametros_entrada: Json
          periodo: string
          proceso_id: string | null
          run_id: string
          unidad: string | null
          valor_original: number | null
          valor_resultado: number
          version_id: string
        }
        Insert: {
          calculado_en?: string
          calculo_tipo: string
          clase_costo_id?: string | null
          concepto: string
          es_override?: boolean
          formula_expresion: string
          formula_id: string
          id?: string
          material_id?: string | null
          motivo_override?: string | null
          nivel_jerarquia?: number
          padre_id?: string | null
          parametros_entrada: Json
          periodo: string
          proceso_id?: string | null
          run_id: string
          unidad?: string | null
          valor_original?: number | null
          valor_resultado: number
          version_id: string
        }
        Update: {
          calculado_en?: string
          calculo_tipo?: string
          clase_costo_id?: string | null
          concepto?: string
          es_override?: boolean
          formula_expresion?: string
          formula_id?: string
          id?: string
          material_id?: string | null
          motivo_override?: string | null
          nivel_jerarquia?: number
          padre_id?: string | null
          parametros_entrada?: Json
          periodo?: string
          proceso_id?: string | null
          run_id?: string
          unidad?: string | null
          valor_original?: number | null
          valor_resultado?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_log_clase_costo_id_fkey"
            columns: ["clase_costo_id"]
            isOneToOne: false
            referencedRelation: "clases_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formula_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "calculation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "calculation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_log_deps: {
        Row: {
          calculo_id: string
          depende_de_id: string
          rol_parametro: string | null
        }
        Insert: {
          calculo_id: string
          depende_de_id: string
          rol_parametro?: string | null
        }
        Update: {
          calculo_id?: string
          depende_de_id?: string
          rol_parametro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculation_log_deps_calculo_id_fkey"
            columns: ["calculo_id"]
            isOneToOne: false
            referencedRelation: "calculation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_log_deps_depende_de_id_fkey"
            columns: ["depende_de_id"]
            isOneToOne: false
            referencedRelation: "calculation_log"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_runs: {
        Row: {
          duracion_ms: number | null
          error_msg: string | null
          estado: string
          finalizado_en: string | null
          id: string
          iniciado_en: string
          iniciado_por: string | null
          procesos_omitidos: Json | null
          total_calculos: number | null
          version_id: string
        }
        Insert: {
          duracion_ms?: number | null
          error_msg?: string | null
          estado?: string
          finalizado_en?: string | null
          id?: string
          iniciado_en?: string
          iniciado_por?: string | null
          procesos_omitidos?: Json | null
          total_calculos?: number | null
          version_id: string
        }
        Update: {
          duracion_ms?: number | null
          error_msg?: string | null
          estado?: string
          finalizado_en?: string | null
          id?: string
          iniciado_en?: string
          iniciado_por?: string | null
          procesos_omitidos?: Json | null
          total_calculos?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calculation_runs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      clases_costo: {
        Row: {
          codigo: string
          cuenta_contrapartida: string | null
          denominacion: string
          denominacion_contrapartida: string | null
          id: string
          tipo: string | null
        }
        Insert: {
          codigo: string
          cuenta_contrapartida?: string | null
          denominacion: string
          denominacion_contrapartida?: string | null
          id?: string
          tipo?: string | null
        }
        Update: {
          codigo?: string
          cuenta_contrapartida?: string | null
          denominacion?: string
          denominacion_contrapartida?: string | null
          id?: string
          tipo?: string | null
        }
        Relationships: []
      }
      costo_proceso: {
        Row: {
          calc_total_id: string | null
          costo_combustible: number | null
          costo_energia: number | null
          costo_materia_prima: number | null
          costo_por_ton: number | null
          costo_por_ton_arrastrado: number | null
          costo_recibido_arrastre: number | null
          costo_repuestos: number | null
          costo_servicios: number | null
          costo_total: number | null
          costo_total_arrastrado: number | null
          id: string
          periodo: string
          proceso_id: string
          run_id: string
          version_id: string
        }
        Insert: {
          calc_total_id?: string | null
          costo_combustible?: number | null
          costo_energia?: number | null
          costo_materia_prima?: number | null
          costo_por_ton?: number | null
          costo_por_ton_arrastrado?: number | null
          costo_recibido_arrastre?: number | null
          costo_repuestos?: number | null
          costo_servicios?: number | null
          costo_total?: number | null
          costo_total_arrastrado?: number | null
          id?: string
          periodo: string
          proceso_id: string
          run_id: string
          version_id: string
        }
        Update: {
          calc_total_id?: string | null
          costo_combustible?: number | null
          costo_energia?: number | null
          costo_materia_prima?: number | null
          costo_por_ton?: number | null
          costo_por_ton_arrastrado?: number | null
          costo_recibido_arrastre?: number | null
          costo_repuestos?: number | null
          costo_servicios?: number | null
          costo_total?: number | null
          costo_total_arrastrado?: number | null
          id?: string
          periodo?: string
          proceso_id?: string
          run_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "costo_proceso_calc_total_id_fkey"
            columns: ["calc_total_id"]
            isOneToOne: false
            referencedRelation: "calculation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costo_proceso_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costo_proceso_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "calculation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costo_proceso_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_definitions: {
        Row: {
          activa: boolean
          codigo: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          expresion: string
          id: string
          nombre: string
          parametros: Json
          retorno_unidad: string | null
          version: number
          version_anterior_id: string | null
        }
        Insert: {
          activa?: boolean
          codigo: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          expresion: string
          id?: string
          nombre: string
          parametros: Json
          retorno_unidad?: string | null
          version?: number
          version_anterior_id?: string | null
        }
        Update: {
          activa?: boolean
          codigo?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          expresion?: string
          id?: string
          nombre?: string
          parametros?: Json
          retorno_unidad?: string | null
          version?: number
          version_anterior_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_definitions_version_anterior_id_fkey"
            columns: ["version_anterior_id"]
            isOneToOne: false
            referencedRelation: "formula_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_dependencies: {
        Row: {
          depende_de_id: string
          formula_id: string
          tipo_dependencia: string
        }
        Insert: {
          depende_de_id: string
          formula_id: string
          tipo_dependencia: string
        }
        Update: {
          depende_de_id?: string
          formula_id?: string
          tipo_dependencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_dependencies_depende_de_id_fkey"
            columns: ["depende_de_id"]
            isOneToOne: false
            referencedRelation: "formula_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_dependencies_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formula_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      humedades: {
        Row: {
          id: string
          material_id: string
          periodo: string
          porcentaje: number
          version_id: string
        }
        Insert: {
          id?: string
          material_id: string
          periodo: string
          porcentaje: number
          version_id: string
        }
        Update: {
          id?: string
          material_id?: string
          periodo?: string
          porcentaje?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "humedades_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "humedades_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      maestro_sap: {
        Row: {
          clase_costo_id: string
          clasificacion: string | null
          id: string
          material_alt_id: string | null
          material_id: string
          orden_sap: string | null
          proceso_id: string
          tipo_insumo: string | null
        }
        Insert: {
          clase_costo_id: string
          clasificacion?: string | null
          id?: string
          material_alt_id?: string | null
          material_id: string
          orden_sap?: string | null
          proceso_id: string
          tipo_insumo?: string | null
        }
        Update: {
          clase_costo_id?: string
          clasificacion?: string | null
          id?: string
          material_alt_id?: string | null
          material_id?: string
          orden_sap?: string | null
          proceso_id?: string
          tipo_insumo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maestro_sap_clase_costo_id_fkey"
            columns: ["clase_costo_id"]
            isOneToOne: false
            referencedRelation: "clases_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maestro_sap_material_alt_id_fkey"
            columns: ["material_alt_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maestro_sap_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maestro_sap_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
        ]
      }
      material_aliases: {
        Row: {
          alias: string
          creado_en: string
          id: string
          material_id: string
          notas: string | null
        }
        Insert: {
          alias: string
          creado_en?: string
          id?: string
          material_id: string
          notas?: string | null
        }
        Update: {
          alias?: string
          creado_en?: string
          id?: string
          material_id?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_aliases_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      materiales: {
        Row: {
          activo: boolean
          categoria: string | null
          codigo: string
          humedad_default: number | null
          id: string
          nombre: string
          tipo_insumo: string | null
          unidad_base: string
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          codigo: string
          humedad_default?: number | null
          id?: string
          nombre: string
          tipo_insumo?: string | null
          unidad_base: string
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          codigo?: string
          humedad_default?: number | null
          id?: string
          nombre?: string
          tipo_insumo?: string | null
          unidad_base?: string
        }
        Relationships: []
      }
      movimientos_contables: {
        Row: {
          calc_id: string | null
          cantidad: number | null
          centro_costo: string | null
          clase_costo_id: string | null
          id: string
          material_id: string | null
          orden_sap: string | null
          periodo: string
          proceso_id: string | null
          run_id: string | null
          texto_breve: string | null
          tipo_movimiento: string | null
          traslado_desde: string | null
          traslado_hasta: string | null
          unidad: string | null
          valor_monetario: number | null
          version_id: string
        }
        Insert: {
          calc_id?: string | null
          cantidad?: number | null
          centro_costo?: string | null
          clase_costo_id?: string | null
          id?: string
          material_id?: string | null
          orden_sap?: string | null
          periodo: string
          proceso_id?: string | null
          run_id?: string | null
          texto_breve?: string | null
          tipo_movimiento?: string | null
          traslado_desde?: string | null
          traslado_hasta?: string | null
          unidad?: string | null
          valor_monetario?: number | null
          version_id: string
        }
        Update: {
          calc_id?: string | null
          cantidad?: number | null
          centro_costo?: string | null
          clase_costo_id?: string | null
          id?: string
          material_id?: string | null
          orden_sap?: string | null
          periodo?: string
          proceso_id?: string | null
          run_id?: string | null
          texto_breve?: string | null
          tipo_movimiento?: string | null
          traslado_desde?: string | null
          traslado_hasta?: string | null
          unidad?: string | null
          valor_monetario?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_contables_calc_id_fkey"
            columns: ["calc_id"]
            isOneToOne: false
            referencedRelation: "calculation_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_clase_costo_id_fkey"
            columns: ["clase_costo_id"]
            isOneToOne: false
            referencedRelation: "clases_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "calculation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_traslado_desde_fkey"
            columns: ["traslado_desde"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_traslado_hasta_fkey"
            columns: ["traslado_hasta"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_contables_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_energia: {
        Row: {
          cargos_fijos: number | null
          composicion_horno: Json | null
          id: string
          kcal_tck: number | null
          kcal_tck_total: number | null
          kwh_ton_proceso: Json | null
          pci_combustibles: Json | null
          pci_ponderado_alternos: number | null
          pci_ponderado_carbones: number | null
          pci_ponderado_diesel: number | null
          pci_ponderado_horno: number | null
          pct_energia_alternos: number | null
          pct_energia_carbones: number | null
          pct_energia_diesel: number | null
          periodo: string
          precio_contrato: number | null
          precio_restricciones: number | null
          version_id: string
        }
        Insert: {
          cargos_fijos?: number | null
          composicion_horno?: Json | null
          id?: string
          kcal_tck?: number | null
          kcal_tck_total?: number | null
          kwh_ton_proceso?: Json | null
          pci_combustibles?: Json | null
          pci_ponderado_alternos?: number | null
          pci_ponderado_carbones?: number | null
          pci_ponderado_diesel?: number | null
          pci_ponderado_horno?: number | null
          pct_energia_alternos?: number | null
          pct_energia_carbones?: number | null
          pct_energia_diesel?: number | null
          periodo: string
          precio_contrato?: number | null
          precio_restricciones?: number | null
          version_id: string
        }
        Update: {
          cargos_fijos?: number | null
          composicion_horno?: Json | null
          id?: string
          kcal_tck?: number | null
          kcal_tck_total?: number | null
          kwh_ton_proceso?: Json | null
          pci_combustibles?: Json | null
          pci_ponderado_alternos?: number | null
          pci_ponderado_carbones?: number | null
          pci_ponderado_diesel?: number | null
          pci_ponderado_horno?: number | null
          pct_energia_alternos?: number | null
          pct_energia_carbones?: number | null
          pct_energia_diesel?: number | null
          periodo?: string
          precio_contrato?: number | null
          precio_restricciones?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_energia_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      roturas_sacos: {
        Row: {
          creado_en: string
          id: string
          material_id: string | null
          periodo: string
          porcentaje_rotura: number
          version_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          material_id?: string | null
          periodo: string
          porcentaje_rotura: number
          version_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          material_id?: string | null
          periodo?: string
          porcentaje_rotura?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roturas_sacos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roturas_sacos_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventarios_finales: {
        Row: {
          cantidad_ton: number | null
          creado_en: string
          id: string
          material_id: string
          periodo: string
          version_id: string
        }
        Insert: {
          cantidad_ton?: number | null
          creado_en?: string
          id?: string
          material_id: string
          periodo: string
          version_id: string
        }
        Update: {
          cantidad_ton?: number | null
          creado_en?: string
          id?: string
          material_id?: string
          periodo?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventarios_finales_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventarios_finales_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      porcentajes_consumo: {
        Row: {
          id: string
          material_id: string
          periodo: string
          porcentaje: number
          proveedor: string
          version_id: string
        }
        Insert: {
          id?: string
          material_id: string
          periodo: string
          porcentaje: number
          proveedor: string
          version_id: string
        }
        Update: {
          id?: string
          material_id?: string
          periodo?: string
          porcentaje?: number
          proveedor?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "porcentajes_consumo_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "porcentajes_consumo_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_insumos: {
        Row: {
          creado_en: string
          creado_por: string | null
          id: string
          material_id: string
          moneda: string
          observaciones: string | null
          periodo: string
          precio_unitario: number
          proveedor: string | null
          unidad: string
          version_id: string
        }
        Insert: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          material_id: string
          moneda?: string
          observaciones?: string | null
          periodo: string
          precio_unitario: number
          proveedor?: string | null
          unidad: string
          version_id: string
        }
        Update: {
          creado_en?: string
          creado_por?: string | null
          id?: string
          material_id?: string
          moneda?: string
          observaciones?: string | null
          periodo?: string
          precio_unitario?: number
          proveedor?: string | null
          unidad?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "precios_insumos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_insumos_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      procesos: {
        Row: {
          activo: boolean
          id: string
          material: string
          nombre: string
          ord: number
          orden_topologico: number
        }
        Insert: {
          activo?: boolean
          id?: string
          material: string
          nombre: string
          ord: number
          orden_topologico: number
        }
        Update: {
          activo?: boolean
          id?: string
          material?: string
          nombre?: string
          ord?: number
          orden_topologico?: number
        }
        Relationships: []
      }
      receta_lineas: {
        Row: {
          id: string
          material_id: string
          orden: number | null
          porcentaje: number
          receta_id: string
        }
        Insert: {
          id?: string
          material_id: string
          orden?: number | null
          porcentaje: number
          receta_id: string
        }
        Update: {
          id?: string
          material_id?: string
          orden?: number | null
          porcentaje?: number
          receta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receta_lineas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receta_lineas_receta_id_fkey"
            columns: ["receta_id"]
            isOneToOne: false
            referencedRelation: "recetas"
            referencedColumns: ["id"]
          },
        ]
      }
      recetas: {
        Row: {
          id: string
          periodo: string
          proceso_id: string
          producto_id: string
          version_id: string
        }
        Insert: {
          id?: string
          periodo: string
          proceso_id: string
          producto_id: string
          version_id: string
        }
        Update: {
          id?: string
          periodo?: string
          proceso_id?: string
          producto_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recetas_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recetas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recetas_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      rendimientos: {
        Row: {
          dias_paro_no_programado: number | null
          dias_paro_programado: number | null
          disponibilidad: number | null
          horas_mes: number | null
          horas_operacion_efectivas: number | null
          id: string
          mro_ton_hr: number | null
          mtbf_mantenimiento: number | null
          mtbf_total: number | null
          oee: number | null
          periodo: string
          proceso_id: string
          produccion_ton: number | null
          rendimiento_ton_hr: number | null
          utilizacion: number | null
          version_id: string
        }
        Insert: {
          dias_paro_no_programado?: number | null
          dias_paro_programado?: number | null
          disponibilidad?: number | null
          horas_mes?: number | null
          horas_operacion_efectivas?: number | null
          id?: string
          mro_ton_hr?: number | null
          mtbf_mantenimiento?: number | null
          mtbf_total?: number | null
          oee?: number | null
          periodo: string
          proceso_id: string
          produccion_ton?: number | null
          rendimiento_ton_hr?: number | null
          utilizacion?: number | null
          version_id: string
        }
        Update: {
          dias_paro_no_programado?: number | null
          dias_paro_programado?: number | null
          disponibilidad?: number | null
          horas_mes?: number | null
          horas_operacion_efectivas?: number | null
          id?: string
          mro_ton_hr?: number | null
          mtbf_mantenimiento?: number | null
          mtbf_total?: number | null
          oee?: number | null
          periodo?: string
          proceso_id?: string
          produccion_ton?: number | null
          rendimiento_ton_hr?: number | null
          utilizacion?: number | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rendimientos_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendimientos_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas_proyectadas: {
        Row: {
          cantidad_ton: number
          id: string
          material_id: string
          periodo: string
          precio_venta: number | null
          presentacion: string | null
          version_id: string
        }
        Insert: {
          cantidad_ton: number
          id?: string
          material_id: string
          periodo: string
          precio_venta?: number | null
          presentacion?: string | null
          version_id: string
        }
        Update: {
          cantidad_ton?: number
          id?: string
          material_id?: string
          periodo?: string
          precio_venta?: number | null
          presentacion?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_proyectadas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_proyectadas_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

