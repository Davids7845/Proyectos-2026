-- Migration 019: Agrega procesos ORD 17, 18, 22 (graneles comerciales).
-- Usa ON CONFLICT (ord) DO NOTHING para ser idempotente.

insert into procesos (ord, material, nombre, orden_topologico) values
  (17, 'CEMENTO UG GRANEL',   'Cemento Granel UG',   18),
  (18, 'CEMENTO ART GRANEL',  'Cemento Granel ART',  19),
  (22, 'FIBROCEMENTO GRANEL', 'Fibrocemento Granel', 20)
on conflict (ord) do nothing;
