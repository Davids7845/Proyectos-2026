-- =========================================================
-- EXTENSIONES
-- =========================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================
-- VERSIONES DE PRESUPUESTO
-- =========================================================
create table budget_versions (
  id            uuid primary key default gen_random_uuid(),
  nombre        varchar(100) not null,
  descripcion   text,
  estado        varchar(20) not null default 'borrador'
                check (estado in ('borrador','calculando','calculado','congelado','archivado')),
  sap_enabled   boolean not null default false,
  precios_fijos boolean not null default false,
  periodo_inicio date not null,
  periodo_fin    date not null,
  creado_por    uuid references auth.users(id),
  creado_en     timestamptz not null default now(),
  modificado_en timestamptz not null default now()
);

-- =========================================================
-- CATÁLOGO DE FÓRMULAS
-- =========================================================
create table formula_definitions (
  id            uuid primary key default gen_random_uuid(),
  codigo        varchar(80) not null,
  nombre        varchar(200) not null,
  descripcion   text,
  expresion     text not null,
  parametros    jsonb not null,
  retorno_unidad varchar(20),
  version       int not null default 1,
  version_anterior_id uuid references formula_definitions(id),
  activa        boolean not null default true,
  creado_en     timestamptz not null default now(),
  creado_por    uuid references auth.users(id),
  unique (codigo, version)
);

create table formula_dependencies (
  formula_id        uuid references formula_definitions(id) on delete cascade,
  depende_de_id     uuid references formula_definitions(id) on delete restrict,
  tipo_dependencia  varchar(20) not null
                    check (tipo_dependencia in ('directa','acumulada','proporcional')),
  primary key (formula_id, depende_de_id),
  check (formula_id <> depende_de_id)
);

-- =========================================================
-- MAESTROS
-- =========================================================
create table procesos (
  id              uuid primary key default gen_random_uuid(),
  ord             int unique not null,
  material        varchar(100) not null,
  nombre          varchar(100) not null,
  orden_topologico int not null,
  activo          boolean not null default true
);

create table clases_costo (
  id              uuid primary key default gen_random_uuid(),
  codigo          varchar(20) unique not null,
  denominacion    varchar(200) not null,
  tipo            varchar(50),
  cuenta_contrapartida varchar(20),
  denominacion_contrapartida varchar(200)
);

create table materiales (
  id              uuid primary key default gen_random_uuid(),
  codigo          varchar(20) unique not null,
  nombre          varchar(200) not null,
  unidad_base     varchar(20) not null,
  categoria       varchar(50),
  tipo_insumo     varchar(50),
  humedad_default decimal(5,4) default 0,
  activo          boolean not null default true
);

create table maestro_sap (
  id              uuid primary key default gen_random_uuid(),
  clase_costo_id  uuid not null references clases_costo(id),
  material_id     uuid not null references materiales(id),
  material_alt_id uuid references materiales(id),
  proceso_id      uuid not null references procesos(id),
  tipo_insumo     varchar(50),
  orden_sap       varchar(20),
  clasificacion   varchar(50),
  unique (clase_costo_id, material_id, proceso_id)
);

-- =========================================================
-- DATOS DE ENTRADA POR VERSIÓN
-- =========================================================
create table precios_insumos (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  material_id     uuid not null references materiales(id),
  proveedor       varchar(100),
  periodo         date not null,
  precio_unitario decimal(18,6) not null,
  unidad          varchar(20) not null,
  moneda          char(3) not null default 'COP',
  observaciones   text,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references auth.users(id)
);
create unique index on precios_insumos (version_id, material_id, coalesce(proveedor,''), periodo);
create index on precios_insumos (version_id, periodo);

create table porcentajes_consumo (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  material_id     uuid not null references materiales(id),
  proveedor       varchar(100) not null,
  periodo         date not null,
  porcentaje      decimal(8,6) not null check (porcentaje >= 0 and porcentaje <= 1),
  unique (version_id, material_id, proveedor, periodo)
);

create table recetas (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  producto_id     uuid not null references materiales(id),
  proceso_id      uuid not null references procesos(id),
  periodo         date not null,
  unique (version_id, producto_id, proceso_id, periodo)
);

create table receta_lineas (
  id              uuid primary key default gen_random_uuid(),
  receta_id       uuid not null references recetas(id) on delete cascade,
  material_id     uuid not null references materiales(id),
  porcentaje      decimal(8,6) not null check (porcentaje >= 0 and porcentaje <= 1),
  orden           int
);

create or replace function check_receta_suma() returns trigger as $$
declare s decimal(10,6);
begin
  select coalesce(sum(porcentaje),0) into s from receta_lineas where receta_id =
    coalesce(new.receta_id, old.receta_id);
  if abs(s - 1) > 0.0001 then
    raise exception 'Receta % suma %, debe ser 1.0', coalesce(new.receta_id, old.receta_id), s;
  end if;
  return null;
end $$ language plpgsql;

create constraint trigger trg_receta_suma
  after insert or update or delete on receta_lineas
  deferrable initially deferred
  for each row execute function check_receta_suma();

create table humedades (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  material_id uuid not null references materiales(id),
  periodo date not null,
  porcentaje decimal(5,4) not null check (porcentaje >= 0 and porcentaje < 1),
  unique (version_id, material_id, periodo)
);

create table rendimientos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  proceso_id uuid not null references procesos(id),
  periodo date not null,
  horas_mes int,
  produccion_ton decimal(12,2),
  horas_operacion_efectivas decimal(8,2),
  rendimiento_ton_hr decimal(8,2),
  mro_ton_hr decimal(8,2),
  dias_paro_programado int default 0,
  dias_paro_no_programado int default 0,
  disponibilidad decimal(5,4),
  utilizacion decimal(5,4),
  oee decimal(5,4),
  mtbf_mantenimiento decimal(10,2),
  mtbf_total decimal(10,2),
  unique (version_id, proceso_id, periodo)
);

create table ventas_proyectadas (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  material_id uuid not null references materiales(id),
  presentacion varchar(50),
  periodo date not null,
  cantidad_ton decimal(12,2) not null,
  precio_venta decimal(18,2)
);
create unique index on ventas_proyectadas (version_id, material_id, coalesce(presentacion,''), periodo);

create table parametros_energia (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  periodo date not null,
  precio_contrato decimal(18,6),
  precio_restricciones decimal(18,6),
  cargos_fijos decimal(18,6),
  kwh_ton_proceso jsonb,
  pci_combustibles jsonb,
  unique (version_id, periodo)
);

-- =========================================================
-- LOG DE CÁLCULOS
-- =========================================================
create table calculation_runs (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  iniciado_en     timestamptz not null default now(),
  finalizado_en   timestamptz,
  estado          varchar(20) not null default 'corriendo'
                  check (estado in ('corriendo','exitoso','error')),
  iniciado_por    uuid references auth.users(id),
  duracion_ms     int,
  total_calculos  int,
  error_msg       text
);

create table calculation_log (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references calculation_runs(id) on delete cascade,
  version_id      uuid not null references budget_versions(id),
  calculo_tipo    varchar(50) not null,
  proceso_id      uuid references procesos(id),
  material_id     uuid references materiales(id),
  clase_costo_id  uuid references clases_costo(id),
  periodo         date not null,
  concepto        varchar(200) not null,
  valor_resultado decimal(18,6) not null,
  unidad          varchar(20),
  formula_id      uuid not null references formula_definitions(id),
  formula_expresion text not null,
  parametros_entrada jsonb not null,
  padre_id        uuid references calculation_log(id),
  nivel_jerarquia int not null default 0,
  es_override     boolean not null default false,
  valor_original  decimal(18,6),
  motivo_override text,
  calculado_en    timestamptz not null default now()
);

create index on calculation_log (version_id, periodo);
create index on calculation_log (run_id);
create index on calculation_log (proceso_id, periodo);
create index on calculation_log (concepto);
create index on calculation_log (padre_id);

create table calculation_log_deps (
  calculo_id      uuid not null references calculation_log(id) on delete cascade,
  depende_de_id   uuid not null references calculation_log(id) on delete restrict,
  rol_parametro   varchar(50),
  primary key (calculo_id, depende_de_id),
  check (calculo_id <> depende_de_id)
);
create index on calculation_log_deps (depende_de_id);

-- =========================================================
-- RESULTADOS AGREGADOS
-- =========================================================
create table costo_proceso (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  run_id          uuid not null references calculation_runs(id),
  proceso_id      uuid not null references procesos(id),
  periodo         date not null,
  costo_materia_prima  decimal(18,2),
  costo_combustible    decimal(18,2),
  costo_energia        decimal(18,2),
  costo_repuestos      decimal(18,2),
  costo_servicios      decimal(18,2),
  costo_total          decimal(18,2),
  costo_por_ton        decimal(18,6),
  costo_recibido_arrastre decimal(18,2),
  costo_total_arrastrado  decimal(18,2),
  costo_por_ton_arrastrado decimal(18,6),
  calc_total_id   uuid references calculation_log(id),
  unique (version_id, proceso_id, periodo)
);

-- =========================================================
-- FASE 2 (preparado, no se llena en Fase 1)
-- =========================================================
create table movimientos_contables (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  run_id uuid references calculation_runs(id),
  periodo date not null,
  clase_costo_id uuid references clases_costo(id),
  material_id uuid references materiales(id),
  proceso_id uuid references procesos(id),
  orden_sap varchar(20),
  centro_costo varchar(10),
  tipo_movimiento varchar(20),
  valor_monetario decimal(18,2),
  cantidad decimal(12,4),
  unidad varchar(20),
  traslado_desde uuid references procesos(id),
  traslado_hasta uuid references procesos(id),
  calc_id uuid references calculation_log(id),
  texto_breve varchar(200)
);

-- =========================================================
-- RLS
-- =========================================================
alter table budget_versions enable row level security;
alter table precios_insumos enable row level security;
alter table porcentajes_consumo enable row level security;
alter table recetas enable row level security;
alter table receta_lineas enable row level security;
alter table humedades enable row level security;
alter table rendimientos enable row level security;
alter table ventas_proyectadas enable row level security;
alter table parametros_energia enable row level security;
alter table calculation_runs enable row level security;
alter table calculation_log enable row level security;
alter table calculation_log_deps enable row level security;
alter table costo_proceso enable row level security;
alter table movimientos_contables enable row level security;
alter table procesos enable row level security;
alter table clases_costo enable row level security;
alter table materiales enable row level security;
alter table maestro_sap enable row level security;
alter table formula_definitions enable row level security;
alter table formula_dependencies enable row level security;

-- Datos operativos: acceso total para usuarios autenticados (Fase 1)
create policy "auth_full_access" on budget_versions     for all to authenticated using (true) with check (true);
create policy "auth_full_access" on precios_insumos     for all to authenticated using (true) with check (true);
create policy "auth_full_access" on porcentajes_consumo for all to authenticated using (true) with check (true);
create policy "auth_full_access" on recetas             for all to authenticated using (true) with check (true);
create policy "auth_full_access" on receta_lineas       for all to authenticated using (true) with check (true);
create policy "auth_full_access" on humedades           for all to authenticated using (true) with check (true);
create policy "auth_full_access" on rendimientos        for all to authenticated using (true) with check (true);
create policy "auth_full_access" on ventas_proyectadas  for all to authenticated using (true) with check (true);
create policy "auth_full_access" on parametros_energia  for all to authenticated using (true) with check (true);
create policy "auth_full_access" on calculation_runs    for all to authenticated using (true) with check (true);
create policy "auth_full_access" on calculation_log     for all to authenticated using (true) with check (true);
create policy "auth_full_access" on calculation_log_deps for all to authenticated using (true) with check (true);
create policy "auth_full_access" on costo_proceso       for all to authenticated using (true) with check (true);
create policy "auth_full_access" on movimientos_contables for all to authenticated using (true) with check (true);

-- Maestros: sólo lectura para autenticados, escritura por service_role (admin)
create policy "auth_read_masters" on procesos            for select to authenticated using (true);
create policy "auth_read_masters" on clases_costo        for select to authenticated using (true);
create policy "auth_read_masters" on materiales          for select to authenticated using (true);
create policy "auth_read_masters" on maestro_sap         for select to authenticated using (true);
create policy "auth_read_masters" on formula_definitions for select to authenticated using (true);
create policy "auth_read_masters" on formula_dependencies for select to authenticated using (true);
