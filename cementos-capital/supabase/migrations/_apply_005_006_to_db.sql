-- Fase 1.5 + 1.6: aplica ambas migraciones de una vez.
-- Pega esto en Supabase SQL Editor y ejecuta.
-- Idempotente: se puede correr múltiples veces sin error.

-- ─── 005: Tablas extra (roturas_sacos, inventarios_finales, parametros_energia v1) ───
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

-- ─── 006: Modelo térmico horno ───
alter table parametros_energia
  add column if not exists kcal_tck                decimal(12, 4),
  add column if not exists pct_energia_carbones    decimal(8, 6),
  add column if not exists pct_energia_alternos    decimal(8, 6),
  add column if not exists pct_energia_diesel      decimal(8, 6),
  add column if not exists pci_ponderado_carbones  decimal(10, 2),
  add column if not exists pci_ponderado_alternos  decimal(10, 2),
  add column if not exists pci_ponderado_diesel    decimal(10, 2);
