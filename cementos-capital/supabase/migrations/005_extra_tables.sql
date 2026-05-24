-- Fase 1.5 paso 2: Tablas extra para las 8 secciones nuevas del importer.
--
-- Diseño:
--   - roturas_sacos: 1 fila por (version, periodo). En el Excel hay un solo
--     porcentaje global de rotura de sacos; no se rompe por SKU. material_id
--     queda opcional para soportar SKU-específico si en el futuro hiciera falta.
--   - inventarios_finales: 1 fila por (version, material, periodo). Cubre los
--     "Inventario Final X" del Excel.
--   - parametros_energia: se agregan campos térmicos (kcal y PCI ponderado).
--     Estos campos son nullable para no romper inserts existentes.

create table if not exists roturas_sacos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  material_id uuid references materiales(id),
  periodo date not null,
  porcentaje_rotura decimal(7,6) not null,
  creado_en timestamptz not null default now(),
  unique (version_id, coalesce(material_id::text, ''), periodo)
);

create table if not exists inventarios_finales (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references budget_versions(id) on delete cascade,
  material_id uuid not null references materiales(id),
  periodo date not null,
  cantidad_ton decimal(14,4),
  creado_en timestamptz not null default now(),
  unique (version_id, material_id, periodo)
);

alter table parametros_energia
  add column if not exists kcal_tck_total decimal(18,4),
  add column if not exists pci_ponderado_horno decimal(12,4),
  add column if not exists composicion_horno jsonb;

alter table roturas_sacos enable row level security;
alter table inventarios_finales enable row level security;

drop policy if exists "auth_full_access" on roturas_sacos;
create policy "auth_full_access" on roturas_sacos for all to authenticated using (true) with check (true);

drop policy if exists "auth_full_access" on inventarios_finales;
create policy "auth_full_access" on inventarios_finales for all to authenticated using (true) with check (true);
