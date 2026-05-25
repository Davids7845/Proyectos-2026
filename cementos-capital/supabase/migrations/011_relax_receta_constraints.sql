-- Relajar constraints en receta_lineas para permitir ratios de consumo > 1.0
-- Caso real: Clinkerización requiere 1.56 ton de harina cruda por 1 ton de clinker
-- (debido a pérdida de masa durante el horno). El modelo Excel usa este ratio en
-- la sección Recetas. La columna porcentaje almacena el ratio (no estrictamente %).
--
-- Cambios:
--  1) Drop CHECK porcentaje <= 1 en receta_lineas, ampliar a 0..10 (margen seguro)
--  2) Drop trigger trg_receta_suma — esa validación (suma=1) no aplica para procesos
--     con pérdida de masa (clinker) o ganancia (cemento + aditivos > 1).
--     Validación queda a nivel aplicación.
--  3) Ampliar precision a decimal(9,6) para soportar valores hasta 999.999999.

-- 1. Drop trigger y función primero (depende de receta_lineas)
DROP TRIGGER IF EXISTS trg_receta_suma ON receta_lineas;
DROP FUNCTION IF EXISTS check_receta_suma();

-- 2. Relajar check constraint y ampliar precision
ALTER TABLE receta_lineas DROP CONSTRAINT IF EXISTS receta_lineas_porcentaje_check;
ALTER TABLE receta_lineas
  ALTER COLUMN porcentaje TYPE decimal(9,6),
  ADD CONSTRAINT receta_lineas_porcentaje_check CHECK (porcentaje >= 0 AND porcentaje <= 10);
