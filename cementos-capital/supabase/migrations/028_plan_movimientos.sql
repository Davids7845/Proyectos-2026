-- 028_plan_movimientos.sql
--
-- Tabla de movimientos por componente y periodo para cálculo de
-- promedio ponderado de costo de proceso.
--
-- Cada fila representa un componente (MP, energía, fijo) de un proceso
-- en un periodo concreto, con su Cantidad y Valor.
--
-- Fórmula de costo ponderado anual (Regla 1):
--   costo = SUM(valor_mes) / SUM(produccion_mes)
--   donde la suma es sobre todos los componentes de todos los periodos del filtro.

CREATE TABLE IF NOT EXISTS plan_movimientos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     UUID NOT NULL REFERENCES budget_versions(id)      ON DELETE CASCADE,
  run_id         UUID NOT NULL REFERENCES calculation_runs(id)     ON DELETE CASCADE,
  proceso_id     UUID NOT NULL,
  periodo        DATE NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN ('mp', 'energia', 'fijo')),
  codigo         TEXT NOT NULL,
  nombre         TEXT NOT NULL,
  -- produccion_ton: producción real o normalizada (1 = 1 ton/período)
  produccion_ton NUMERIC(18,6) NOT NULL DEFAULT 1,
  -- cantidad = produccion_ton × receta% × (1+humedad) [MP] o × kwh_ton [energía] o × 1 [fijo]
  cantidad       NUMERIC(18,6) NOT NULL,
  -- costo_unitario: COP/ton-material para MP, COP/kWh para energía, COP/ton-producto para fijo
  costo_unitario NUMERIC(18,4) NOT NULL,
  -- valor = costo_unitario × cantidad
  valor          NUMERIC(18,4) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_movimientos_version_proceso_periodo
  ON plan_movimientos(version_id, proceso_id, periodo);

-- RLS: misma política que costo_proceso (acceso solo a usuarios autenticados)
ALTER TABLE plan_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "plan_movimientos_auth"
  ON plan_movimientos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
