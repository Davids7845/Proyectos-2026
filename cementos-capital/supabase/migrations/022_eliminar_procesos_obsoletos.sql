-- Migration 022: Eliminación TOTAL de ORD 15 (Cemento UG TP) y ORD 19 (Big Bag).
-- Decisión del usuario: opción A (eliminación completa, no archivado).
-- Orden: borrar todas las tablas dependientes antes de borrar procesos.

-- 1) calculation_log (cascade a calculation_log_deps via FK)
delete from calculation_log
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 2) movimientos_contables (proceso_id + traslado_desde + traslado_hasta)
delete from movimientos_contables
  where proceso_id in (select id from procesos where ord in (15, 19))
     or traslado_desde in (select id from procesos where ord in (15, 19))
     or traslado_hasta in (select id from procesos where ord in (15, 19));

-- 3) costo_proceso
delete from costo_proceso
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 4) costos_reales
delete from costos_reales
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 5) recetas (receta_lineas se borra en cascade)
delete from recetas
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 6) costos_fijos_proceso
delete from costos_fijos_proceso
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 7) energia_overrides
delete from energia_overrides
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 8) mp_overrides
delete from mp_overrides
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 9) rendimientos
delete from rendimientos
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 10) precios_fijos_overrides
delete from precios_fijos_overrides
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 11) maestro_sap
delete from maestro_sap
  where proceso_id in (select id from procesos where ord in (15, 19));

-- 12) Finalmente eliminar los procesos
delete from procesos where ord in (15, 19);

-- Verificación
do $$
declare
  n int;
begin
  select count(*) into n from procesos where ord in (15, 19);
  if n > 0 then
    raise exception 'ORD 15 o 19 todavía existen en procesos. Abortar.';
  end if;
  raise notice 'ORD 15 y 19 eliminados correctamente.';
end $$;
