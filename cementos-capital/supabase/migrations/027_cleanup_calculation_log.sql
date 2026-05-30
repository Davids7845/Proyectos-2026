-- 027_cleanup_calculation_log.sql
--
-- Resuelve la acumulación de runs en calculation_log:
--
-- 1. Cambia la FK calculation_log_deps.depende_de_id de RESTRICT → CASCADE.
--    Permite que el runner borre calculation_log con un DELETE simple, sin tener
--    que limpiar manualmente los deps primero (el DELETE en cascade los elimina).
--
-- 2. Limpia el histórico acumulado de calculation_log: conserva solo el run
--    exitoso más reciente por versión. Borra los deps automáticamente por CASCADE.
--
-- Idempotente: puede aplicarse más de una vez sin efecto negativo.

-- ─── 1) FK RESTRICT → CASCADE ──────────────────────────────────────────────────

ALTER TABLE calculation_log_deps
  DROP CONSTRAINT IF EXISTS calculation_log_deps_depende_de_id_fkey,
  ADD CONSTRAINT calculation_log_deps_depende_de_id_fkey
    FOREIGN KEY (depende_de_id) REFERENCES calculation_log(id) ON DELETE CASCADE;

-- ─── 2) Limpieza del histórico acumulado ────────────────────────────────────────

-- Cuenta previa (verificar antes de borrar):
-- SELECT COUNT(*) AS logs_a_borrar
-- FROM calculation_log
-- WHERE run_id NOT IN (
--   SELECT DISTINCT ON (version_id) id
--   FROM calculation_runs
--   WHERE estado = 'exitoso'
--   ORDER BY version_id, iniciado_en DESC
-- )
-- AND run_id IN (SELECT id FROM calculation_runs WHERE estado = 'exitoso');

-- Borrar deps y logs de runs exitosos que no sean el más reciente por versión.
-- Los deps se eliminan por CASCADE automáticamente al borrar los logs.
DELETE FROM calculation_log
WHERE run_id NOT IN (
  SELECT DISTINCT ON (version_id) id
  FROM calculation_runs
  WHERE estado = 'exitoso'
  ORDER BY version_id, iniciado_en DESC
)
AND run_id IN (SELECT id FROM calculation_runs WHERE estado = 'exitoso');

-- ─── 3) Verificación ────────────────────────────────────────────────────────────
-- SELECT version_id, COUNT(DISTINCT run_id) AS runs_en_log
-- FROM calculation_log
-- GROUP BY version_id
-- ORDER BY runs_en_log DESC;
