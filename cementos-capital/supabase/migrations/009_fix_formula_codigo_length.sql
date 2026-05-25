-- Fix: formula_definitions.codigo era varchar(20) en producción, insuficiente
-- para códigos como COSTO_MEZCLA_PONDERADA_v1 (25 chars).
-- La migración 001 ya dice varchar(80) pero la BD fue creada con varchar(20).
ALTER TABLE formula_definitions ALTER COLUMN codigo TYPE varchar(80);
