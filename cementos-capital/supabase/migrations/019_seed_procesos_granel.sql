-- Migration 019: Agrega procesos de Granel Comercial faltantes.
--
-- NOTA: ORD 12 ("CEMENTO A GRANEL ART") ya existe en BD desde una migración
-- anterior y cumple la función de "Cemento Granel ART". Por eso este archivo
-- sólo crea ORD 17 (Cemento Granel UG) y ORD 22 (Fibrocemento Granel).
-- ON CONFLICT (ord) DO NOTHING para que sea idempotente.

insert into procesos (ord, material, nombre, orden_topologico) values
  (17, 'CEMENTO UG GRANEL',   'Cemento Granel UG',   18),
  (22, 'FIBROCEMENTO GRANEL', 'Fibrocemento Granel', 20)
on conflict (ord) do nothing;
