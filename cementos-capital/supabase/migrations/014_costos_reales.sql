-- Fase 2b: costos reales por proceso × material × período.
-- Estructura espejo de la hoja "Costo" del Excel — cada fila representa
-- un concepto consumido (material, energía o costo fijo) en un proceso
-- durante un período mensual.

create table if not exists costos_reales (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  periodo         date not null,
  proceso_id      uuid not null references procesos(id),
  material_id     uuid references materiales(id),
  -- concepto: distingue filas que no son material (energia/fijo) y agrupa
  -- los costos fijos por código (BARRAS_PLAC, REGALIAS, etc.).
  concepto_tipo   varchar(20) not null
    check (concepto_tipo in ('material', 'energia', 'fijo')),
  concepto_codigo varchar(50) not null,
  row_excel       integer not null,
  consumo         decimal(18,6),
  precio_unitario decimal(18,4),
  valor_monetario decimal(18,2) not null,
  unidad          varchar(20),
  observaciones   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Una sola fila por (versión, período, proceso, concepto). Para materiales
-- el concepto_codigo será el código del material; para fijos será el código
-- listado en COSTOS_FIJOS_CONFIG; para energía un literal 'ENERGIA'.
create unique index if not exists ux_costos_reales_unique
  on costos_reales (version_id, periodo, proceso_id, concepto_tipo, concepto_codigo);

create index if not exists idx_costos_reales_periodo
  on costos_reales (version_id, periodo);
create index if not exists idx_costos_reales_proceso
  on costos_reales (version_id, proceso_id, periodo);
create index if not exists idx_costos_reales_material
  on costos_reales (material_id) where material_id is not null;

alter table costos_reales enable row level security;

create policy "costos_reales read auth" on costos_reales
  for select to authenticated using (true);
create policy "costos_reales write auth" on costos_reales
  for all to authenticated using (true) with check (true);

grant select on costos_reales to authenticated;
grant all    on costos_reales to service_role;

-- Vista de comparación presupuesto vs real: agrega movimientos_contables
-- (lado presupuesto, generado por el motor) y costos_reales (lado real,
-- cargado desde Excel) por proceso × material × período.
create or replace view v_desviaciones as
with ppto as (
  -- Lado presupuesto: agregamos las entradas (entrada = consumo) ignoramos
  -- traslados que tienen valor_monetario null.
  select
    m.version_id,
    m.periodo,
    m.proceso_id,
    m.material_id,
    sum(m.valor_monetario) as valor_ppto,
    sum(m.cantidad)        as cantidad_ppto
  from movimientos_contables m
  where m.tipo_movimiento = 'entrada'
  group by m.version_id, m.periodo, m.proceso_id, m.material_id
), real as (
  select
    r.version_id,
    r.periodo,
    r.proceso_id,
    r.material_id,
    sum(r.valor_monetario) as valor_real,
    sum(r.consumo)         as cantidad_real
  from costos_reales r
  group by r.version_id, r.periodo, r.proceso_id, r.material_id
)
select
  coalesce(p.version_id, r.version_id) as version_id,
  coalesce(p.periodo,    r.periodo)    as periodo,
  coalesce(p.proceso_id, r.proceso_id) as proceso_id,
  coalesce(p.material_id, r.material_id) as material_id,
  p.valor_ppto,
  p.cantidad_ppto,
  r.valor_real,
  r.cantidad_real,
  (coalesce(r.valor_real,0) - coalesce(p.valor_ppto,0)) as delta_valor,
  case when p.valor_ppto is null or p.valor_ppto = 0 then null
       else (coalesce(r.valor_real,0) - p.valor_ppto) / p.valor_ppto
  end as delta_pct
from ppto p
full outer join real r
  on p.version_id = r.version_id
 and p.periodo    = r.periodo
 and p.proceso_id = r.proceso_id
 and p.material_id is not distinct from r.material_id;

grant select on v_desviaciones to authenticated;
