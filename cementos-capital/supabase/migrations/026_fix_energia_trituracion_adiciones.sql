-- 026_fix_energia_trituracion_adiciones.sql
--
-- Corrige dos bugs de energía que afectan TODOS los meses de cualquier versión:
--
-- 1. Agrega las claves "trituracion" y "adiciones" al jsonb kwh_ton_proceso
--    en parametros_energia cuando están ausentes. Valor: 1.27 kWh/Ton
--    (verificado contra Excel: 63,808 kWh / 50,242 Ton producción).
--    Sin estas claves, el motor no puede calcular costo_energia para ORD 1 y ORD 2.
--
-- 2. Elimina los overrides de energía erróneos de ORD 2 (Adiciones) en la tabla
--    energia_overrides. El valor importado del Excel ($477) corresponde al costo
--    de "Barras y Placas" de Trituración — un dato incorrecto en la fila 19 de la
--    hoja Costo. Al eliminarlo, el motor cae al path parametros_energia que usa
--    kwh_ton_proceso["adiciones"] = 1.27 y produce ~$662/Ton.
--
-- Idempotente: puede aplicarse múltiples veces sin efecto negativo.
-- Aplica a TODAS las versiones (no solo v14) para que futuras versiones también
-- funcionen correctamente.

-- ─── 1) Agregar claves kwh_ton faltantes ──────────────────────────────────────

-- Añade "trituracion": 1.27 cuando la clave no existe
UPDATE parametros_energia
SET kwh_ton_proceso = COALESCE(kwh_ton_proceso, '{}'::jsonb) || '{"trituracion": 1.27}'::jsonb
WHERE (kwh_ton_proceso IS NULL OR NOT (kwh_ton_proceso ? 'trituracion'));

-- Añade "adiciones": 1.27 cuando la clave no existe
UPDATE parametros_energia
SET kwh_ton_proceso = COALESCE(kwh_ton_proceso, '{}'::jsonb) || '{"adiciones": 1.27}'::jsonb
WHERE (kwh_ton_proceso IS NULL OR NOT (kwh_ton_proceso ? 'adiciones'));

-- ─── 2) Eliminar overrides erróneos de ORD 2 ──────────────────────────────────

-- Elimina TODOS los overrides de energía para ORD 2 (Adiciones).
-- El importer los crea desde la hoja Costo, fila 19, que contiene datos
-- incorrectos. Sin el override, el motor usa kwh_ton_proceso["adiciones"] = 1.27.
DELETE FROM energia_overrides eo
WHERE eo.proceso_id IN (SELECT id FROM procesos WHERE ord = 2);

-- ─── 3) Verificación (ejecutar manualmente después de aplicar) ─────────────────
-- Descomentar para ver el estado resultante:

-- SELECT version_id,
--        kwh_ton_proceso->>'trituracion' AS kWh_trituracion,
--        kwh_ton_proceso->>'adiciones'   AS kWh_adiciones
-- FROM parametros_energia
-- ORDER BY version_id, periodo
-- LIMIT 20;

-- SELECT COUNT(*) AS overrides_ord2_restantes
-- FROM energia_overrides eo
-- JOIN procesos p ON p.id = eo.proceso_id
-- WHERE p.ord = 2;
