-- Fase 2a: columnas adicionales en movimientos_contables para reproducir
-- la hoja Base del Excel SAP (campos de clasificación, tipo, arrastre, etc.)

alter table movimientos_contables
  add column if not exists clasificacion        varchar(50),
  add column if not exists tipo_insumo          varchar(50),
  add column if not exists arrastre_a           varchar(50),
  add column if not exists concatenado          varchar(200),
  add column if not exists fecha_documento      date,
  add column if not exists fecha_contabilizacion date,
  add column if not exists denominacion_clase_contrapartida varchar(200);

-- Índices para queries frecuentes en la UI Base
create index if not exists idx_mov_version_periodo
  on movimientos_contables (version_id, periodo);
create index if not exists idx_mov_clase_costo
  on movimientos_contables (clase_costo_id);
create index if not exists idx_mov_proceso
  on movimientos_contables (proceso_id);
create index if not exists idx_mov_run
  on movimientos_contables (run_id);

-- Vista con denominaciones resueltas para la UI (evita N joins en el frontend)
create or replace view v_movimientos_base as
select
  m.id,
  m.version_id,
  m.run_id,
  m.periodo,
  m.tipo_movimiento,
  cc.codigo               as clase_costo_codigo,
  cc.denominacion         as clase_costo_denom,
  m.valor_monetario,
  m.cantidad,
  m.unidad,
  m.denominacion_clase_contrapartida,
  cc.cuenta_contrapartida,
  m.centro_costo,
  mat.codigo              as material_codigo,
  mat.nombre              as material_nombre,
  m.orden_sap,
  m.fecha_contabilizacion,
  m.fecha_documento,
  m.clasificacion,
  proc.nombre             as proceso_nombre,
  proc.ord,
  m.concatenado,
  m.tipo_insumo,
  m.arrastre_a,
  m.calc_id
from movimientos_contables m
left join clases_costo cc  on cc.id  = m.clase_costo_id
left join materiales   mat on mat.id = m.material_id
left join procesos     proc on proc.id = m.proceso_id;

-- RLS: la vista hereda las policies de movimientos_contables
grant select on v_movimientos_base to authenticated;
