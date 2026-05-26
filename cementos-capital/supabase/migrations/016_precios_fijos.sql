-- =========================================================
-- 016_precios_fijos.sql
-- Permite definir precios fijos por proceso × periodo para una versión.
-- Activo solo cuando budget_versions.precios_fijos = true (columna ya existe).
-- Usado por el motor para saltar el cálculo de Prehomo (ORD 1) y
-- Caliza Triturada (ORD 2) y usar el valor fijo en su lugar.
-- =========================================================

create table if not exists precios_fijos_overrides (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid not null references budget_versions(id) on delete cascade,
  proceso_id      uuid not null references procesos(id),
  periodo         date not null,
  precio_cop_ton  decimal(18,6) not null,
  observaciones   text,
  created_at      timestamptz not null default now(),
  unique (version_id, proceso_id, periodo)
);

create index if not exists idx_pfo_version on precios_fijos_overrides (version_id);

alter table precios_fijos_overrides enable row level security;

drop policy if exists "auth_full_access" on precios_fijos_overrides;
create policy "auth_full_access"
  on precios_fijos_overrides
  for all
  to authenticated
  using (true)
  with check (true);
