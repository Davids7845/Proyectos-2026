-- Migration 024: Verificación final del estado de BD tras Sub-sesión 1.
-- Falla con error claro si el estado no es el esperado.

do $$
declare
  n_mat  int;
  n_proc int;
  ords_actuales  int[];
  ords_esperados int[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16, 17, 18, 20, 21, 22];
begin
  -- ── Materiales ─────────────────────────────────────────────────────────
  select count(*) into n_mat from materiales;
  raise notice 'Total materiales: %', n_mat;
  if n_mat < 120 then
    raise exception 'Esperado >= 120 materiales, encontrados %.', n_mat;
  end if;

  -- ── Procesos ───────────────────────────────────────────────────────────
  select count(*) into n_proc from procesos;
  select array_agg(ord order by ord) into ords_actuales from procesos;
  raise notice 'Total procesos: %', n_proc;
  raise notice 'ORDs actuales: %', ords_actuales;

  if not (ords_esperados <@ ords_actuales) then
    raise exception 'Faltan ORDs esperados. Esperados: %, actuales: %', ords_esperados, ords_actuales;
  end if;

  -- ── ORD 15 y 19 eliminados ─────────────────────────────────────────────
  if exists (select 1 from procesos where ord in (15, 19)) then
    raise exception 'ORD 15 o 19 todavía existen en procesos. Verificar migration 022.';
  end if;

  -- ── Tablas auxiliares existen ──────────────────────────────────────────
  if not exists (select 1 from information_schema.tables where table_name = 'material_agregados') then
    raise exception 'Tabla material_agregados no existe.';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'humedades_materiales') then
    raise exception 'Tabla humedades_materiales no existe.';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'precios_energia_periodo') then
    raise exception 'Tabla precios_energia_periodo no existe.';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'produccion_venta_periodo') then
    raise exception 'Tabla produccion_venta_periodo no existe.';
  end if;

  raise notice '✓ BD en estado válido para Sub-sesión 2 (Importer).';
  raise notice '  Materiales: %   Procesos: %   ORDs: %', n_mat, n_proc, ords_actuales;
end $$;
