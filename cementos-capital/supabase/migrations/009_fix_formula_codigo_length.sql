-- Fix: columnas varchar(20) en formula_definitions insuficientes para valores reales.
-- - codigo: COSTO_MEZCLA_PONDERADA_v1 = 25 chars, COSTO_SERVICIOS_PROCESO_v1 = 26 chars
-- - retorno_unidad: "Ton combustible / Ton Clinker" = 29 chars
-- La migración 001 ya define varchar(80) pero la BD de producción fue creada con varchar(20).
ALTER TABLE formula_definitions ALTER COLUMN codigo TYPE varchar(80);
ALTER TABLE formula_definitions ALTER COLUMN retorno_unidad TYPE varchar(80);
