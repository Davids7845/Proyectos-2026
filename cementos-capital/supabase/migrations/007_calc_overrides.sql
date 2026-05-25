-- Migración 007: tablas de overrides para el motor de cálculo.
-- Persisten los valores del Excel "Costo" (hoja Presupuesto):
--   costos_fijos_proceso  → repuestos / servicios / regalías por proceso
--   energia_overrides     → kWh/Ton y precio efectivo por proceso
--   mp_overrides          → consumo (Ton/Ton) y precio (COP/Ton) por proceso+material

CREATE TABLE IF NOT EXISTS costos_fijos_proceso (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     UUID        NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id     UUID        NOT NULL REFERENCES procesos(id),
  periodo        DATE        NOT NULL,
  codigo         TEXT        NOT NULL,
  nombre         TEXT        NOT NULL,
  costo_por_ton  NUMERIC(18,4) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costos_fijos_version
  ON costos_fijos_proceso(version_id, proceso_id, periodo);

CREATE TABLE IF NOT EXISTS energia_overrides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id       UUID        NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id       UUID        NOT NULL REFERENCES procesos(id),
  periodo          DATE        NOT NULL,
  kwh_ton          NUMERIC(12,6) NOT NULL,
  precio_efectivo  NUMERIC(18,4) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, proceso_id, periodo)
);

CREATE TABLE IF NOT EXISTS mp_overrides (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id       UUID        NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id       UUID        NOT NULL REFERENCES procesos(id),
  material_codigo  TEXT        NOT NULL,
  periodo          DATE        NOT NULL,
  consumo_ton_ton  NUMERIC(12,6),
  precio_cop_ton   NUMERIC(18,4),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, proceso_id, material_codigo, periodo)
);
CREATE INDEX IF NOT EXISTS idx_mp_overrides_version
  ON mp_overrides(version_id, proceso_id, periodo);
