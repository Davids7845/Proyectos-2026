-- POC 002: Seed de datos para ORD 3 (Molienda de Crudo), período 1 (Sep-2025)
-- Datos verificados celda-a-celda contra Nueva_Plantilla_Ppto_CV_V2.xlsx.
-- Producción Crudo: 132,000 Ton.
--
-- Nota sobre precios: los precios listados son los valores originales del Excel.
-- El campo (Precio + Flete) en el Excel incluye celdas adicionales no siempre
-- visibles (Datos!I48 + Datos!H90 para CORRHIERR). Las diferencias resultantes
-- son < 1% vs el objetivo de $31,752.89.

do $$ declare v_id uuid; begin

-- Usar la primera versión disponible (o crear una temporal)
select id into v_id from budget_versions limit 1;
if v_id is null then
  raise exception 'No hay budget_versions; crear al menos una antes de seedear';
end if;

-- ── Producción ORD 3 ────────────────────────────────────────────────────────
insert into poc_produccion (version_id, ord, periodo, toneladas)
values (v_id, 3, 1, 132000)
on conflict (version_id, ord, periodo) do update set toneladas = excluded.toneladas;

-- ── Receta ORD 3, período 1 ─────────────────────────────────────────────────
delete from poc_recetas where version_id = v_id and ord = 3 and periodo = 1;
insert into poc_recetas (version_id, ord, material_codigo, tipo, es_cascada, ord_origen, periodo, receta_pct, precio, flete, humedad, unidad_calculo)
values
  -- Cascadas (valor heredado del proceso origen)
  (v_id, 3, 'MEZCPREHO',      'Prehomo',                   true,  1, 1, 0.8313,    null,       0, 0,     'cascada'),
  (v_id, 3, 'CALIZATRI',      'Caliza Adiciones',           true,  2, 1, 0.1828,    null,       0, 0,     'cascada'),
  -- Minerales (receta × (1+humedad))
  (v_id, 3, 'CORRHIERR',      'Mineral de Hierro',          false, null, 1, 0.0201875, 299941.95, 0, 0.10, 'receta_humedad'),
  (v_id, 3, 'CALAMINA1',      'Mineral de Hierro',          false, null, 1, 0.0035625, 169514.65, 0, 0.063,'receta_humedad'),
  -- Repuestos (por_ton: cantidad = producción, precio es COP/Ton)
  (v_id, 3, 'CUERPOS_MOL_CR', 'Cuerpos Moledores',          false, null, 1, 1,         167.11,    0, 0,    'por_ton'),
  (v_id, 3, 'LAMINAS_CR',     'Láminas',                    false, null, 1, 1,         119.88,    0, 0,    'por_ton'),
  (v_id, 3, 'ANILLOS_CR',     'Anillos, Tapas y Separadores',false,null, 1, 1,         498.70,    0, 0,    'por_ton'),
  -- Energía (kWh/Ton × precio_efectivo_kWh)
  (v_id, 3, 'ENERGIA',        'Energía',                    false, null, 1, 15.1,      521.62,    0, 0,    'energia'),
  -- Placeholder (sin valor este período)
  (v_id, 3, 'SILICE',         'Sílice',                     false, null, 1, 0,         0,         0, 0,    'placeholder');

-- ── Costos totales de procesos origen (para resolver cascadas) ───────────────
-- ORD 1: Trituración = 15,372.59 COP/Ton
-- ORD 2: Adiciones   = 16,036.45 COP/Ton
delete from poc_costo where version_id = v_id and ord in (1, 2) and periodo = 1 and es_total = true;
insert into poc_costo (version_id, ord, periodo, tipo, aporte_por_ton, es_total)
values
  (v_id, 1, 1, 'TOTAL', 15372.59, true),
  (v_id, 2, 1, 'TOTAL', 16036.45, true);

end $$;
