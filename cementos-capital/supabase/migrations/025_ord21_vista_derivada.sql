-- Migration 025: ORD 21 como vista derivada (no es un proceso calculable).
--
-- ORD 21 (Cementos Consolidado) deja de tener calculadora propia. Su valor
-- se computa on-the-fly como promedio ponderado por producción de los 9
-- procesos finales: 8, 9, 10, 11, 14, 16, 17, 18, 22.
--
-- Cambios:
--   1. Nueva columna procesos.es_vista_derivada (boolean).
--   2. Marcar ORD 21 con es_vista_derivada = true.
--   3. Limpiar calculation_log residual de ORD 21 (sesiones anteriores).
--   4. Limpiar costo_proceso residual de ORD 21.

alter table procesos add column if not exists es_vista_derivada boolean default false;

update procesos set es_vista_derivada = true where ord = 21;

-- Limpieza de datos residuales en logs y costos
delete from calculation_log
where proceso_id in (select id from procesos where ord = 21);

delete from costo_proceso
where proceso_id in (select id from procesos where ord = 21);

-- Verificación
do $$
declare
  n_log   int;
  n_costo int;
  n_flag  int;
begin
  select count(*) into n_log
  from calculation_log cl
  join procesos p on p.id = cl.proceso_id
  where p.ord = 21;
  if n_log > 0 then
    raise exception 'Aún hay % registros en calculation_log para ORD 21', n_log;
  end if;

  select count(*) into n_costo
  from costo_proceso cp
  join procesos p on p.id = cp.proceso_id
  where p.ord = 21;
  if n_costo > 0 then
    raise exception 'Aún hay % registros en costo_proceso para ORD 21', n_costo;
  end if;

  select count(*) into n_flag
  from procesos
  where ord = 21 and es_vista_derivada = true;
  if n_flag = 0 then
    raise exception 'ORD 21 no quedó marcado como vista derivada';
  end if;

  raise notice 'ORD 21 listo como vista derivada (sin calculation_log ni costo_proceso).';
end $$;
