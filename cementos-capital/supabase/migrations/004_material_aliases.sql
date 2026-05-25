-- Tabla de alias para mapear nombres del Excel a códigos de la tabla materiales.
-- El importer consulta esta tabla como fallback cuando el nombre crudo del Excel
-- no coincide con materiales.nombre por norm() simple.
--
-- Diseño:
--   - alias es UNIQUE (un mismo texto no mapea a dos materiales)
--   - varios alias pueden apuntar al mismo material_id (sinónimos / proveedores)
--   - on delete cascade: si se borra el material, sus aliases también

create table if not exists material_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  material_id uuid not null references materiales(id) on delete cascade,
  notas text,
  creado_en timestamptz not null default now()
);

create unique index if not exists material_aliases_alias_uniq
  on material_aliases (lower(alias));

create index if not exists material_aliases_material_idx
  on material_aliases (material_id);

-- RLS: lectura pública para autenticados, escritura solo para service_role.
alter table material_aliases enable row level security;

drop policy if exists "aliases_read" on material_aliases;
create policy "aliases_read" on material_aliases
  for select to authenticated using (true);

-- service_role bypasea RLS automáticamente; no necesita policy explícita.

-- GRANT explícito para PostgREST (Supabase requiere esto en algunos proyectos).
grant select on material_aliases to authenticated, anon;
grant all    on material_aliases to service_role;
