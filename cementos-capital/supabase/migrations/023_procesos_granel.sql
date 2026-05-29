-- Migration 023: Procesos granel comercial (sin saco).
-- ORD 17: Cemento Granel UG  (cascadea de ORD 6) — ya existe vía mig 019, se actualiza código/tipo.
-- ORD 18: Cemento Granel ART (cascadea de ORD 7) — nuevo.
-- ORD 22: Fibrocemento Granel (cascadea de ORD 16) — ya existe vía mig 019, se actualiza.

-- Insertar los que no existan (ORD 17 y 22 ya existen; ON CONFLICT los omite).
insert into procesos (ord, material, nombre, orden_topologico, codigo, tipo, consolidable, activo) values
  (17, 'CEMENTO UG GRANEL',   'Cemento Granel UG',   18, 'CEM_GRANEL_UG',   'granel', false, true),
  (18, 'CEMENTO ART GRANEL',  'Cemento Granel ART',  19, 'CEM_GRANEL_ART',  'granel', false, true),
  (22, 'FIBROCEMENTO GRANEL', 'Fibrocemento Granel', 20, 'FIBROCEM_GRANEL', 'granel', false, true)
on conflict (ord) do nothing;

-- Actualizar código/tipo en los que ya existían (mig 019 los insertó sin esas columnas).
update procesos set codigo = 'CEM_GRANEL_UG',   tipo = 'granel', consolidable = false where ord = 17 and codigo is null;
update procesos set codigo = 'FIBROCEM_GRANEL', tipo = 'granel', consolidable = false where ord = 22 and codigo is null;

-- Verificación
do $$
declare
  n int;
begin
  select count(*) into n from procesos where ord in (17, 18, 22);
  if n != 3 then
    raise exception 'Esperado 3 procesos granel (ORD 17, 18, 22), encontrado %.', n;
  end if;
  raise notice 'Procesos granel ORD 17, 18, 22 confirmados.';
end $$;
