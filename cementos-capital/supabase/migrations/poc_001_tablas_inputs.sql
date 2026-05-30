-- POC 001: Tablas de inputs del motor de fórmulas (Datos → Base → TD → Costo)
-- Rama: poc/motor-formulas — NO afecta las tablas productivas.
-- Sufijo _poc en todo para aislarlo del esquema existente.

create table if not exists poc_recetas (
  id            uuid primary key default uuid_generate_v4(),
  version_id    uuid references budget_versions(id) on delete cascade,
  ord           int not null,
  material_codigo text not null,
  tipo          text not null,           -- "Mineral de Hierro", "Prehomo", etc.
  es_cascada    boolean default false,
  ord_origen    int,                      -- si es_cascada: ORD del proceso que lo produce
  periodo       int not null,             -- 1..N (número de período, no fecha)
  receta_pct    numeric(14,8),            -- fracción de receta; kWh/ton para energía; 1 para por_ton
  precio        numeric(18,4),            -- precio unitario (NULL si cascada)
  flete         numeric(18,4) default 0,
  humedad       numeric(8,6) default 0,
  unidad_calculo text not null check (
    unidad_calculo in ('receta_humedad','por_ton','energia','cascada','placeholder')
  ),
  creado_en timestamptz default now()
);

create table if not exists poc_produccion (
  id         uuid primary key default uuid_generate_v4(),
  version_id uuid references budget_versions(id) on delete cascade,
  ord        int not null,
  periodo    int not null,
  toneladas  numeric(16,4),
  unique(version_id, ord, periodo)
);

-- Movimientos generados (espejo de la hoja "Base" del Excel)
create table if not exists poc_movimientos (
  id              uuid primary key default uuid_generate_v4(),
  version_id      uuid references budget_versions(id) on delete cascade,
  ord             int not null,
  periodo         int not null,
  material_codigo text,
  tipo            text,
  cantidad        numeric(18,4),
  valor           numeric(20,4),   -- NULL para cascadas (se resuelve en reporte)
  es_cascada      boolean default false,
  ord_origen      int,
  consumo_unitario numeric(18,8),
  creado_en       timestamptz default now()
);

-- Resultado de costo (espejo de la hoja "Costo" del Excel)
create table if not exists poc_costo (
  id               uuid primary key default uuid_generate_v4(),
  version_id       uuid references budget_versions(id) on delete cascade,
  ord              int not null,
  periodo          int not null,
  tipo             text,
  consumo_unitario numeric(18,8),
  costo_unitario   numeric(18,4),
  aporte_por_ton   numeric(18,4),
  es_total         boolean default false,
  creado_en        timestamptz default now()
);

comment on table poc_recetas    is 'POC motor fórmulas — recetas e insumos por proceso/período';
comment on table poc_produccion is 'POC motor fórmulas — producción por proceso/período';
comment on table poc_movimientos is 'POC motor fórmulas — movimientos generados (hoja Base)';
comment on table poc_costo       is 'POC motor fórmulas — resultado de costo (hoja Costo)';
