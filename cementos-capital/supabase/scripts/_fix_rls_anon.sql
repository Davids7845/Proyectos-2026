-- =========================================================
-- FIX: RLS bloqueado para rol anon en tablas operativas
--
-- Síntoma: el smoke test detectó que el anon key puede leer
-- filas de budget_versions (y posiblemente otras tablas).
--
-- Causa habitual: las migrations se corrieron piecemeal en
-- el SQL Editor y la sección RLS fue omitida, o Supabase
-- aplicó un GRANT implícito que creó políticas permisivas.
--
-- PASO 1 — Diagnóstico: pega esto primero para ver el estado.
-- =========================================================

-- Ver qué tablas tienen RLS habilitado o no:
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Ver todas las políticas RLS existentes:
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- =========================================================
-- PASO 2 — Fix: re-habilitar RLS y asegurar políticas.
-- Ejecuta esto SOLO si el paso 1 confirmó que alguna tabla
-- tiene rowsecurity = false, o tiene políticas para "anon".
-- =========================================================

-- Tablas operativas: acceso total solo para authenticated
ALTER TABLE budget_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_insumos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE porcentajes_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE receta_lineas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE humedades           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_proyectadas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_energia  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_log_deps ENABLE ROW LEVEL SECURITY;
ALTER TABLE costo_proceso       ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_contables ENABLE ROW LEVEL SECURITY;

-- Borrar políticas viejas si existen (para recrearlas limpio)
DROP POLICY IF EXISTS "auth_full_access" ON budget_versions;
DROP POLICY IF EXISTS "auth_full_access" ON precios_insumos;
DROP POLICY IF EXISTS "auth_full_access" ON porcentajes_consumo;
DROP POLICY IF EXISTS "auth_full_access" ON recetas;
DROP POLICY IF EXISTS "auth_full_access" ON receta_lineas;
DROP POLICY IF EXISTS "auth_full_access" ON humedades;
DROP POLICY IF EXISTS "auth_full_access" ON rendimientos;
DROP POLICY IF EXISTS "auth_full_access" ON ventas_proyectadas;
DROP POLICY IF EXISTS "auth_full_access" ON parametros_energia;
DROP POLICY IF EXISTS "auth_full_access" ON calculation_runs;
DROP POLICY IF EXISTS "auth_full_access" ON calculation_log;
DROP POLICY IF EXISTS "auth_full_access" ON calculation_log_deps;
DROP POLICY IF EXISTS "auth_full_access" ON costo_proceso;
DROP POLICY IF EXISTS "auth_full_access" ON movimientos_contables;

-- Recrear con rol explícito authenticated (no anon)
CREATE POLICY "auth_full_access" ON budget_versions     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON precios_insumos     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON porcentajes_consumo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON recetas             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON receta_lineas       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON humedades           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON rendimientos        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON ventas_proyectadas  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON parametros_energia  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON calculation_runs    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON calculation_log     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON calculation_log_deps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON costo_proceso       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full_access" ON movimientos_contables FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tablas maestros: solo lectura para authenticated
ALTER TABLE procesos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases_costo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_sap         ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_masters" ON procesos;
DROP POLICY IF EXISTS "auth_read_masters" ON clases_costo;
DROP POLICY IF EXISTS "auth_read_masters" ON materiales;
DROP POLICY IF EXISTS "auth_read_masters" ON maestro_sap;
DROP POLICY IF EXISTS "auth_read_masters" ON formula_definitions;
DROP POLICY IF EXISTS "auth_read_masters" ON formula_dependencies;

CREATE POLICY "auth_read_masters" ON procesos            FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_masters" ON clases_costo        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_masters" ON materiales          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_masters" ON maestro_sap         FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_masters" ON formula_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_masters" ON formula_dependencies FOR SELECT TO authenticated USING (true);

-- material_aliases: lectura autenticados, sin escritura anon
ALTER TABLE material_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aliases_read" ON material_aliases;
CREATE POLICY "aliases_read" ON material_aliases FOR SELECT TO authenticated USING (true);

-- GRANT explícito para PostgREST (requerido por Supabase)
-- Las tablas operativas: solo authenticated puede acceder vía API
GRANT SELECT ON material_aliases TO authenticated;
GRANT ALL    ON material_aliases TO service_role;

-- =========================================================
-- PASO 3 — Verificación post-fix
-- =========================================================
-- Re-corre el smoke test local: npm run db:smoke
-- Debe mostrar 6/6 checks OK.
