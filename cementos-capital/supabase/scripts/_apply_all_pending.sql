-- Aplica migraciones 005, 006 y 007 de una vez.
-- Pega en Supabase SQL Editor y ejecuta. Idempotente.

-- ─── 005: Tablas extra (roturas_sacos, inventarios_finales, parametros_energia) ───

CREATE TABLE IF NOT EXISTS roturas_sacos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materiales(id),
  periodo DATE NOT NULL,
  porcentaje_rotura DECIMAL(8,6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventarios_finales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiales(id),
  periodo DATE NOT NULL,
  cantidad_ton DECIMAL(14,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, material_id, periodo)
);

CREATE TABLE IF NOT EXISTS parametros_energia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  periodo DATE NOT NULL,
  precio_contrato DECIMAL(14,4),
  precio_restricciones DECIMAL(14,4),
  cargos_fijos DECIMAL(14,4),
  kwh_ton_proceso JSONB,
  pci_combustibles JSONB,
  kcal_tck_total DECIMAL(12,4),
  pci_ponderado_horno DECIMAL(12,4),
  composicion_horno JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, periodo)
);

CREATE TABLE IF NOT EXISTS rendimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id UUID NOT NULL REFERENCES procesos(id),
  periodo DATE NOT NULL,
  horas_mes DECIMAL(8,2),
  produccion_ton DECIMAL(14,4),
  horas_operacion_efectivas DECIMAL(8,2),
  rendimiento_ton_hr DECIMAL(10,4),
  disponibilidad DECIMAL(8,6),
  utilizacion DECIMAL(8,6),
  oee DECIMAL(8,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, proceso_id, periodo)
);

-- ─── 006: Campos modelo térmico en parametros_energia ───

ALTER TABLE parametros_energia
  ADD COLUMN IF NOT EXISTS kcal_tck               DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS pct_energia_carbones   DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS pct_energia_alternos   DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS pct_energia_diesel     DECIMAL(8,6),
  ADD COLUMN IF NOT EXISTS pci_ponderado_carbones DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS pci_ponderado_alternos DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS pci_ponderado_diesel   DECIMAL(10,2);

-- ─── 007: Tablas de overrides para motor de cálculo ───

CREATE TABLE IF NOT EXISTS costos_fijos_proceso (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id    UUID        NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id    UUID        NOT NULL REFERENCES procesos(id),
  periodo       DATE        NOT NULL,
  codigo        TEXT        NOT NULL,
  nombre        TEXT        NOT NULL,
  costo_por_ton NUMERIC(18,4) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_costos_fijos_version
  ON costos_fijos_proceso(version_id, proceso_id, periodo);

CREATE TABLE IF NOT EXISTS energia_overrides (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID        NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id      UUID        NOT NULL REFERENCES procesos(id),
  periodo         DATE        NOT NULL,
  kwh_ton         NUMERIC(12,6) NOT NULL,
  precio_efectivo NUMERIC(18,4) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, proceso_id, periodo)
);

CREATE TABLE IF NOT EXISTS mp_overrides (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      UUID        NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  proceso_id      UUID        NOT NULL REFERENCES procesos(id),
  material_codigo TEXT        NOT NULL,
  periodo         DATE        NOT NULL,
  consumo_ton_ton NUMERIC(12,6),
  precio_cop_ton  NUMERIC(18,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, proceso_id, material_codigo, periodo)
);
CREATE INDEX IF NOT EXISTS idx_mp_overrides_version
  ON mp_overrides(version_id, proceso_id, periodo);
