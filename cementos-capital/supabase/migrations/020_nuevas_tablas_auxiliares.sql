-- Migration 020: Tablas auxiliares nuevas + extensión del schema de procesos
-- Sub-sesión 1 — Fase 3

-- ─── 1. EXTENSIÓN DE TABLA PROCESOS ────────────────────────────────────────
-- Agrega columnas descriptivas que usarán sub-sesiones 6 y 7.
alter table procesos
  add column if not exists codigo       varchar(30),
  add column if not exists tipo         varchar(30),
  add column if not exists consolidable boolean not null default false;

-- ─── 2. TABLA material_agregados ───────────────────────────────────────────
-- Define composiciones de materiales agregados (Carbón = mezcla de proveedores, etc.)
create table if not exists material_agregados (
  id                   uuid primary key default uuid_generate_v4(),
  material_destino_id  uuid references materiales(id) on delete cascade,
  material_origen_id   uuid references materiales(id) on delete cascade,
  porcentaje           numeric(10,6) not null check (porcentaje >= 0 and porcentaje <= 1),
  orden                integer default 0,
  notas                text,
  creado_en            timestamptz default now(),
  unique(material_destino_id, material_origen_id)
);
create index if not exists idx_material_agregados_destino on material_agregados(material_destino_id);

-- ─── 3. TABLA humedades_materiales ─────────────────────────────────────────
-- Información operacional de humedad — NO afecta cálculo de costos.
create table if not exists humedades_materiales (
  id          uuid primary key default uuid_generate_v4(),
  version_id  uuid references budget_versions(id) on delete cascade,
  material_id uuid references materiales(id) on delete cascade,
  periodo     date,
  humedad     numeric(5,4) not null check (humedad >= 0 and humedad < 1),
  notas       text,
  creado_en   timestamptz default now()
);
create unique index if not exists uq_humedades_v_m_p
  on humedades_materiales(version_id, material_id, coalesce(periodo, '1900-01-01'::date));

-- ─── 4. TABLA precios_energia_periodo ──────────────────────────────────────
-- Precios mensuales de energía eléctrica por componente.
create table if not exists precios_energia_periodo (
  id                        uuid primary key default uuid_generate_v4(),
  version_id                uuid references budget_versions(id) on delete cascade,
  periodo                   date not null,
  precio_kwh                numeric(12,4) not null,
  componente_contrato       numeric(12,4),
  componente_restricciones  numeric(12,4),
  componente_cargos_fijos   numeric(12,4),
  notas                     text,
  creado_en                 timestamptz default now()
);
create unique index if not exists uq_precios_energia_v_p on precios_energia_periodo(version_id, periodo);

-- ─── 5. TABLA produccion_venta_periodo ─────────────────────────────────────
-- Ventas y producción por proceso × mes.
create table if not exists produccion_venta_periodo (
  id                  uuid primary key default uuid_generate_v4(),
  version_id          uuid references budget_versions(id) on delete cascade,
  proceso_id          uuid references procesos(id) on delete cascade,
  periodo             date not null,
  toneladas           numeric(14,2),
  horas_efectivas     numeric(10,2),
  rendimiento_ton_hr  numeric(10,4),
  notas               text,
  creado_en           timestamptz default now()
);
create unique index if not exists uq_prod_v_p_p on produccion_venta_periodo(version_id, proceso_id, periodo);

-- ─── 6. COLUMNA rotura_sacos EN budget_versions ────────────────────────────
alter table budget_versions
  add column if not exists rotura_sacos numeric(5,4) default 0.02
    check (rotura_sacos >= 0 and rotura_sacos < 1);

-- ─── 7. RLS ────────────────────────────────────────────────────────────────
alter table material_agregados      enable row level security;
alter table humedades_materiales    enable row level security;
alter table precios_energia_periodo enable row level security;
alter table produccion_venta_periodo enable row level security;

drop policy if exists "allow_authenticated_material_agregados"      on material_agregados;
drop policy if exists "allow_authenticated_humedades_materiales"    on humedades_materiales;
drop policy if exists "allow_authenticated_precios_energia_periodo" on precios_energia_periodo;
drop policy if exists "allow_authenticated_produccion_venta_periodo" on produccion_venta_periodo;

create policy "allow_authenticated_material_agregados"
  on material_agregados for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_authenticated_humedades_materiales"
  on humedades_materiales for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_authenticated_precios_energia_periodo"
  on precios_energia_periodo for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow_authenticated_produccion_venta_periodo"
  on produccion_venta_periodo for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─── 8. GRANTS ─────────────────────────────────────────────────────────────
grant all on material_agregados      to authenticated;
grant all on humedades_materiales    to authenticated;
grant all on precios_energia_periodo to authenticated;
grant all on produccion_venta_periodo to authenticated;
