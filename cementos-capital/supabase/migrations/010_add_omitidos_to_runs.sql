-- Diagnóstico: persistir procesos_omitidos en calculation_runs
-- Permite ver desde la UI qué procesos fallaron y por qué (ej. "ORD1 2025-09-01: faltan precios...")
ALTER TABLE calculation_runs
  ADD COLUMN IF NOT EXISTS procesos_omitidos jsonb;
