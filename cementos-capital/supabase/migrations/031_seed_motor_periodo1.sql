-- 031: Seed del motor de fórmulas — Período 1 (R6b paso 1).
-- GENERADO automáticamente desde lib/calc/motor/seed_periodo1.ts
-- (no editar a mano: regenerar con scripts/generar_seed_sql.ts).
--
-- Puebla produccion_proceso + receta_componentes para que el endpoint
-- /recalcular-motor pueda calcular y llenar costo_calculado.
-- Idempotente: borra el período 1 de esta versión antes de insertar.

do $$
declare
  v_version uuid;
begin
  -- Por defecto toma la versión más reciente. Para fijar una versión
  -- concreta, reemplaza la línea siguiente por:  v_version := 'TU-UUID';
  select id into v_version from budget_versions order by creado_en desc limit 1;
  if v_version is null then
    raise exception 'No hay budget_versions en la base';
  end if;

  delete from receta_componentes where version_id = v_version and periodo = 1;
  delete from produccion_proceso where version_id = v_version and periodo = 1;

  insert into produccion_proceso (version_id, ord, periodo, toneladas) values
    (v_version, 1, 1, 108900),
    (v_version, 2, 1, 120000),
    (v_version, 3, 1, 132000),
    (v_version, 4, 1, 9193.13),
    (v_version, 20, 1, 1578.87),
    (v_version, 5, 1, 82350),
    (v_version, 6, 1, 63731.15),
    (v_version, 7, 1, 32219.36),
    (v_version, 16, 1, 2800.74),
    (v_version, 8, 1, 1),
    (v_version, 9, 1, 1),
    (v_version, 10, 1, 1),
    (v_version, 11, 1, 1),
    (v_version, 14, 1, 1),
    (v_version, 17, 1, 1),
    (v_version, 18, 1, 1),
    (v_version, 22, 1, 1);

  insert into receta_componentes
    (version_id, ord, periodo, orden_visual, material_codigo, tipo,
     unidad_calculo, es_cascada, ord_origen, receta_pct, precio, flete, humedad) values
    (v_version, 1, 1, 0, 'Arcilla', 'Arcilla', 'receta_humedad', false, null, 0.2079, 10624.194324194325, 0, 0),
    (v_version, 1, 1, 1, 'Caliza', 'Caliza', 'receta_humedad', false, null, 0.7921, 13977.780583259688, 0, 0),
    (v_version, 1, 1, 2, 'Barras y Placas', 'Barras y Placas', 'por_ton', false, null, 1, 903.51, 0, 0),
    (v_version, 1, 1, 3, 'Material Dique', 'Material Dique', 'por_ton', false, null, 1, 369.16, 0, 0),
    (v_version, 1, 1, 4, 'ENERGIA', 'Energía', 'energia', false, null, 1.27, 525.15, 0, 0),
    (v_version, 1, 1, 5, 'Regalías', 'Regalías', 'por_ton', false, null, 1, 152.42, 0, 0),
    (v_version, 2, 1, 0, 'Caliza', 'Caliza', 'receta_humedad', false, null, 1, 13978.13, 0, 0),
    (v_version, 2, 1, 1, 'Barras y Placas', 'Barras y Placas', 'por_ton', false, null, 1, 903.51, 0, 0),
    (v_version, 2, 1, 2, 'Material Dique', 'Material Dique', 'por_ton', false, null, 1, 369.16, 0, 0),
    (v_version, 2, 1, 3, 'ENERGIA', 'Energía', 'energia', false, null, 1.27, 525.24, 0, 0),
    (v_version, 2, 1, 4, 'Regalías', 'Regalías', 'por_ton', false, null, 1, 118.59, 0, 0),
    (v_version, 3, 1, 0, 'Prehomo', 'Prehomo', 'cascada', true, 1, 0.8313, null, 0, 0),
    (v_version, 3, 1, 1, 'Caliza Adiciones', 'Caliza Adiciones', 'cascada', true, 2, 0.1828, null, 0, 0),
    (v_version, 3, 1, 2, 'Mineral de Hierro', 'Mineral de Hierro', 'receta_humedad', false, null, 0.0201875, 300826.56909653806, 0, 0.1),
    (v_version, 3, 1, 3, 'Mineral de Hierro', 'Mineral de Hierro', 'receta_humedad', false, null, 0.0035625, 170398.90412767572, 0, 0.063),
    (v_version, 3, 1, 4, 'Cuerpos Moledores', 'Cuerpos Moledores', 'por_ton', false, null, 1, 167.11, 0, 0),
    (v_version, 3, 1, 5, 'Láminas', 'Láminas', 'por_ton', false, null, 1, 119.88, 0, 0),
    (v_version, 3, 1, 6, 'Anillos, Tapas y Separadores', 'Anillos, Tapas y Separadores', 'por_ton', false, null, 1, 498.7, 0, 0),
    (v_version, 3, 1, 7, 'ENERGIA', 'Energía', 'energia', false, null, 15.1, 525.15, 0, 0),
    (v_version, 3, 1, 8, 'Sílice', 'Sílice', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 4, 1, 0, 'Carbón', 'Carbón', 'receta_humedad', false, null, 0.8529, 382685.40274358075, 0, 0),
    (v_version, 4, 1, 1, 'Carbón', 'Carbón', 'receta_humedad', false, null, 0.2132, 150274.9061913696, 0, 0),
    (v_version, 4, 1, 2, 'Cuerpos Moledores y Láminas', 'Cuerpos Moledores y Láminas', 'por_ton', false, null, 1, 3788.98, 0, 0),
    (v_version, 4, 1, 3, 'Descargue Finos Carbón', 'Descargue Finos Carbón', 'por_ton', false, null, 1, 1855.01, 0, 0),
    (v_version, 4, 1, 4, 'Desatasque De Carbón', 'Desatasque De Carbón', 'por_ton', false, null, 1, 3861.42, 0, 0),
    (v_version, 4, 1, 5, 'ENERGIA', 'Energía', 'energia', false, null, 28, 521.36, 0, 0),
    (v_version, 4, 1, 6, 'Cargador Carbón', 'Cargador Carbón', 'por_ton', false, null, 1, 6743.07, 0, 0),
    (v_version, 20, 1, 0, 'CDR', 'CDR', 'receta_humedad', false, null, 0.8144, 318238.35952848726, 0, 0),
    (v_version, 20, 1, 1, 'Llanta Picada (TDF)', 'Llanta Picada (TDF)', 'receta_humedad', false, null, 0.1856, 318384.7521551724, 0, 0),
    (v_version, 20, 1, 2, 'Briquetas', 'Briquetas', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 20, 1, 3, 'Chip de Madera', 'Chip de Madera', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 20, 1, 4, 'ENERGIA', 'Energía', 'energia', false, null, 8.4, 521.36, 0, 0),
    (v_version, 20, 1, 5, 'Cargue Alternos', 'Cargue Alternos', 'por_ton', false, null, 1, 7600.35, 0, 0),
    (v_version, 20, 1, 6, 'Descargue Alternos', 'Descargue Alternos', 'por_ton', false, null, 1, 10725, 0, 0),
    (v_version, 5, 1, 0, 'Crudo', 'Crudo', 'cascada', true, 3, 1.56, null, 0, 0),
    (v_version, 5, 1, 1, 'Carbón Molido', 'Carbón Molido', 'cascada', true, 4, 0.1116, null, 0, 0),
    (v_version, 5, 1, 2, 'Combustibles Alternos', 'Combustibles Alternos', 'cascada', true, 20, 0.0192, null, 0, 0),
    (v_version, 5, 1, 3, 'Ductos', 'Ductos', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 5, 1, 4, 'Enfriador', 'Enfriador', 'por_ton', false, null, 1, 184.46, 0, 0),
    (v_version, 5, 1, 5, 'Placas', 'Placas', 'por_ton', false, null, 1, 1263.31, 0, 0),
    (v_version, 5, 1, 6, 'Refractarios', 'Refractarios', 'por_ton', false, null, 1, 3600.61, 0, 0),
    (v_version, 5, 1, 7, 'Sellado', 'Sellado', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 5, 1, 8, 'Gasoil', 'Gasoil', 'por_ton', false, null, 1, 291.44, 0, 0),
    (v_version, 5, 1, 9, 'Cargue Clinker', 'Cargue Clinker', 'por_ton', false, null, 1, 187.01, 0, 0),
    (v_version, 5, 1, 10, 'Cargue Ck Tolva', 'Cargue Ck Tolva', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 5, 1, 11, 'ENERGIA', 'Energía', 'energia', false, null, 30.7, 525.15, 0, 0),
    (v_version, 6, 1, 0, 'Clinker', 'Clinker', 'cascada', true, 5, 0.52, null, 0, 0),
    (v_version, 6, 1, 1, 'Caliza Triturada', 'Caliza Triturada', 'cascada', true, 2, 0.3878, null, 0, 0),
    (v_version, 6, 1, 2, 'Finos Filtro', 'Finos Filtro', 'cascada', true, 3, 0.0301, null, 0, 0),
    (v_version, 6, 1, 3, 'Yeso', 'Yeso', 'receta_humedad', false, null, 0.041, 232801.7073170732, 0, 0),
    (v_version, 6, 1, 4, 'Aditivo Molienda', 'Aditivo Molienda', 'receta_humedad', false, null, 0.0005, 4396360, 0, 0),
    (v_version, 6, 1, 5, 'Puzolana', 'Puzolana', 'receta_humedad', false, null, 0.03, 105013.66666666667, 0, 0),
    (v_version, 6, 1, 6, 'Placas y Segmentos', 'Placas y Segmentos', 'por_ton', false, null, 1, 1539.64, 0, 0),
    (v_version, 6, 1, 7, 'ENERGIA', 'Energía', 'energia', false, null, 25.7, 525.28, 0, 0),
    (v_version, 6, 1, 8, 'Sal Marina', 'Sal Marina', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 6, 1, 9, 'Gasoil', 'Gasoil', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 6, 1, 10, 'Dosificador de Sal', 'Dosificador de Sal', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 7, 1, 0, 'Clinker', 'Clinker', 'cascada', true, 5, 0.83, null, 0, 0),
    (v_version, 7, 1, 1, 'Caliza Triturada', 'Caliza Triturada', 'cascada', true, 2, 0.0622, null, 0, 0),
    (v_version, 7, 1, 2, 'Finos Filtro', 'Finos Filtro', 'cascada', true, 3, 0.03, null, 0, 0),
    (v_version, 7, 1, 3, 'Yeso', 'Yeso', 'receta_humedad', false, null, 0.079, 232692.5316455696, 0, 0),
    (v_version, 7, 1, 4, 'Aditivo Molienda', 'Aditivo Molienda', 'receta_humedad', false, null, 0.0005, 4396360, 0, 0),
    (v_version, 7, 1, 5, 'Placas y Segmentos', 'Placas y Segmentos', 'por_ton', false, null, 1, 1492.68, 0, 0),
    (v_version, 7, 1, 6, 'ENERGIA', 'Energía', 'energia', false, null, 34.6, 525.28, 0, 0),
    (v_version, 7, 1, 7, 'Puzolana', 'Puzolana', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 7, 1, 8, 'Sal Marina', 'Sal Marina', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 7, 1, 9, 'Gasoil', 'Gasoil', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 7, 1, 10, 'Dosificador de Sal', 'Dosificador de Sal', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 16, 1, 0, 'Clinker', 'Clinker', 'cascada', true, 5, 0.914, null, 0, 0),
    (v_version, 16, 1, 1, 'Caliza Triturada', 'Caliza Triturada', 'cascada', true, 2, 0, null, 0, 0),
    (v_version, 16, 1, 2, 'Yeso', 'Yeso', 'receta_humedad', false, null, 0.0872, 232432.45412844038, 0, 0),
    (v_version, 16, 1, 3, 'Placas y Segmentos', 'Placas y Segmentos', 'por_ton', false, null, 1, 1492.68, 0, 0),
    (v_version, 16, 1, 4, 'ENERGIA', 'Energía', 'energia', false, null, 34.8, 525.28, 0, 0),
    (v_version, 16, 1, 5, 'Finos Filtro', 'Finos Filtro', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 16, 1, 6, 'Sal Marina', 'Sal Marina', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 16, 1, 7, 'Aditivo Molienda', 'Aditivo Molienda', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 16, 1, 8, 'Puzolana', 'Puzolana', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 16, 1, 9, 'Dosificador de Sal', 'Dosificador de Sal', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 16, 1, 10, 'Gasoil', 'Gasoil', 'placeholder', false, null, 0, 0, 0, 0),
    (v_version, 8, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 6, 1, null, 0, 0),
    (v_version, 8, 1, 1, 'SACOS', 'Sacos', 'sacos', false, null, 20.4, 1181.1958333333332, 0, 0),
    (v_version, 8, 1, 2, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 9, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 6, 1, null, 0, 0),
    (v_version, 9, 1, 1, 'SACOS', 'Sacos', 'sacos', false, null, 24, 1129.7222916666667, 0, 0),
    (v_version, 9, 1, 2, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 10, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 6, 1, null, 0, 0),
    (v_version, 10, 1, 1, 'SACOS', 'Sacos', 'sacos', false, null, 40.8, 835.5827205882357, 0, 0),
    (v_version, 10, 1, 2, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 11, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 7, 1, null, 0, 0),
    (v_version, 11, 1, 1, 'SACOS', 'Sacos', 'sacos', false, null, 24, 1061.5547916666658, 0, 0),
    (v_version, 11, 1, 2, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 14, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 6, 1, null, 0, 0),
    (v_version, 14, 1, 1, 'SACOS', 'Sacos', 'sacos', false, null, 20.4, 1323.5639705882359, 0, 0),
    (v_version, 14, 1, 2, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 17, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 6, 1, null, 0, 0),
    (v_version, 17, 1, 1, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 17, 1, 2, 'Cargue Granel', 'Cargue Granel', 'por_ton', false, null, 1, 3679.98, 0, 0),
    (v_version, 18, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 7, 1, null, 0, 0),
    (v_version, 18, 1, 1, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 18, 1, 2, 'Cargue Granel', 'Cargue Granel', 'por_ton', false, null, 1, 3679.98, 0, 0),
    (v_version, 22, 1, 0, 'Cemento', 'Cemento', 'cascada', true, 16, 1, null, 0, 0),
    (v_version, 22, 1, 1, 'ENERGIA', 'Energía', 'energia', false, null, 1.5, 525.15, 0, 0),
    (v_version, 22, 1, 2, 'Cargue Granel', 'Cargue Granel', 'por_ton', false, null, 1, 3679.98, 0, 0);

  raise notice 'Seed motor período 1 cargado para versión %', v_version;
end $$;
