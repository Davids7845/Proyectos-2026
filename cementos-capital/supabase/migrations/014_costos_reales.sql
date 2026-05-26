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
  -- row_excel: NULL cuando los datos vienen del motor de cálculo (no de Excel).
  row_excel       integer,
  consumo         decimal(18,6),
  precio_unitario decimal(18,4),
  -- valor_monetario está en COP por tonelada de producto del proceso,
  -- consistente con la col "Total" de la hoja Costo del Excel.
  valor_monetario decimal(18,2) not null,
  unidad          varchar(20),
  -- origen: 'excel' = panel Real de hoja Costo; 'calc' = derivado del motor.
  origen          varchar(10) not null default 'excel'
    check (origen in ('excel', 'calc')),
  run_id          uuid references calculation_runs(id),
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

drop policy if exists "costos_reales read auth"  on costos_reales;
drop policy if exists "costos_reales write auth" on costos_reales;
create policy "costos_reales read auth" on costos_reales
  for select to authenticated using (true);
create policy "costos_reales write auth" on costos_reales
  for all to authenticated using (true) with check (true);

grant select on costos_reales to authenticated;
grant all    on costos_reales to service_role;

-- Vista de comparación presupuesto vs real: agrega movimientos_contables
-- (lado presupuesto, generado por el motor) y costos_reales (lado real,
-- cargado desde Excel o desde un run del motor) por proceso × material ×
-- período. Ambos lados se normalizan a COP por tonelada de producto.
create or replace view v_desviaciones as
with ppto_abs as (
  -- Lado presupuesto: agregamos las entradas (entrada = consumo) ignoramos
  -- traslados que tienen valor_monetario null.
  select
    m.version_id,
    m.periodo,
    m.proceso_id,
    m.material_id,
    sum(m.valor_monetario) as valor_abs,
    sum(m.cantidad)        as cantidad_abs
  from movimientos_contables m
  where m.tipo_movimiento = 'entrada'
  group by m.version_id, m.periodo, m.proceso_id, m.material_id
), rend as (
  select r.version_id, r.periodo, r.proceso_id, r.produccion_ton
  from rendimientos r
  where r.produccion_ton is not null and r.produccion_ton > 0
), ppto as (
  select
    p.version_id,
    p.periodo,
    p.proceso_id,
    p.material_id,
    -- Convertir a COP/Ton de producto si hay producción registrada
    case when r.produccion_ton is not null
         then p.valor_abs / r.produccion_ton
         else null end as valor_ppto,
    p.cantidad_abs as cantidad_ppto
  from ppto_abs p
  left join rend r
    on r.version_id = p.version_id
   and r.periodo    = p.periodo
   and r.proceso_id = p.proceso_id
), reales as (
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
  coalesce(p.version_id,  reales.version_id)  as version_id,
  coalesce(p.periodo,     reales.periodo)     as periodo,
  coalesce(p.proceso_id,  reales.proceso_id)  as proceso_id,
  coalesce(p.material_id, reales.material_id) as material_id,
  p.valor_ppto,
  p.cantidad_ppto,
  reales.valor_real,
  reales.cantidad_real,
  (coalesce(reales.valor_real, 0) - coalesce(p.valor_ppto, 0)) as delta_valor,
  case when p.valor_ppto is null or p.valor_ppto = 0 then null
       else (coalesce(reales.valor_real, 0) - p.valor_ppto) / p.valor_ppto
  end as delta_pct
from ppto p
full outer join reales
  on p.version_id  = reales.version_id
 and p.periodo     = reales.periodo
 and p.proceso_id  = reales.proceso_id
 and p.material_id is not distinct from reales.material_id;

grant select on v_desviaciones to authenticated;
