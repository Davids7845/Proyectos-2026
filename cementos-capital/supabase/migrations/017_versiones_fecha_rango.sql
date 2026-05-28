-- Migration 017: rango de fechas configurable por versión.
-- Reemplaza el período fijo Sep 2025 – Ago 2026 por un rango libre [fecha_inicio, fecha_fin].

alter table budget_versions
  add column if not exists fecha_inicio date,
  add column if not exists fecha_fin    date;

-- Backfill: versiones existentes mantienen su rango actual si tienen periodo_inicio/fin,
-- de lo contrario default al Sep 2025–Ago 2026.
update budget_versions
set fecha_inicio = coalesce(periodo_inicio, '2025-09-01'),
    fecha_fin    = coalesce(periodo_fin,    '2026-08-01')
where fecha_inicio is null or fecha_fin is null;

alter table budget_versions
  alter column fecha_inicio set not null,
  alter column fecha_fin    set not null;

alter table budget_versions
  add constraint chk_fechas_rango
  check (fecha_fin > fecha_inicio);

-- Helper: lista de períodos (primer día de cada mes) dentro del rango de una versión.
create or replace function periodos_de_version(version_uuid uuid)
returns table (periodo date)
language sql
stable
as $$
  select generate_series(
    (select fecha_inicio from budget_versions where id = version_uuid),
    (select fecha_fin    from budget_versions where id = version_uuid),
    interval '1 month'
  )::date;
$$;
