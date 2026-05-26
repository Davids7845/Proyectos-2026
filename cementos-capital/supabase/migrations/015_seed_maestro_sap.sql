-- =========================================================
-- 015_seed_maestro_sap.sql
-- Puebla maestro_sap con los 123 mapeos (material × proceso → clase_costo)
-- extraídos de la hoja "Maestro" del archivo presupuesto.
-- Idempotente: ON CONFLICT DO NOTHING en cada insert.
-- =========================================================

-- ─── 1. CLASES DE COSTO adicionales (no presentes en 002_seed_masters) ─────
INSERT INTO clases_costo (codigo, denominacion, tipo)
VALUES
  ('7360050302', 'CTO BOLSAS IMP',                'EMPAQUE'),
  ('7495700001', 'SERVICIOS DE EXPLOTA',           'SERVICIO'),
  ('7355250321', 'REPTOS DESGASTE (321)',           'REPUESTOS'),
  ('7355250322', 'REPTOS DESGASTE (322)',           'REPUESTOS'),
  ('7355250323', 'REPTOS DESGASTE (323)',           'REPUESTOS'),
  ('7355250324', 'REPTOS DESGASTE (324)',           'REPUESTOS'),
  ('7355250325', 'REPTOS DESGASTE (325)',           'REPUESTOS'),
  ('7355300105', 'REFRACTARIOS (300105)',           'REPUESTOS'),
  ('7405990999', 'OTROS SERVICIOS',                'SERVICIO'),
  ('7199990002', 'CONSUMOS SEMIELABORADOS (2)',     'SEMIELABORADO'),
  ('7105240101', 'MP ADICIO ACTIVA NAL',            'MP'),
  ('7355050101', 'CTO. COMBUSTIBLES ALTERNOS',     'COMBUSTIBLE'),
  ('7105400101', 'CTO.MP COMPUESTO NAL',            'MP')
ON CONFLICT (codigo) DO NOTHING;

-- ─── 2. PROCESOS faltantes (ORD 12, 13) ─────────────────────────────────────
INSERT INTO procesos (ord, material, nombre, orden_topologico)
VALUES
  (12, 'CEMENTO A GRANEL ART', 'CEMENTO A GRANEL ART', 18),
  (13, 'CEMENTO ART 50 KG',    'CEMENTO ART 50 KG',    19)
ON CONFLICT (ord) DO NOTHING;

-- ─── 3. MATERIALES faltantes ─────────────────────────────────────────────────
INSERT INTO materiales (codigo, nombre, unidad_base, categoria, tipo_insumo)
VALUES
  ('SAL_MARINA',  'Sal Marina',    'T', 'materia_prima', 'Sal Marina'),
  ('CHIP_MADERA', 'Chip de Madera','T', 'combustible',   'Alternos')
ON CONFLICT (codigo) DO NOTHING;

-- ─── 4. MAESTRO_SAP — 123 entradas ──────────────────────────────────────────
-- Patrón: INSERT ... SELECT con subqueries para resolver UUIDs.
-- WHERE EXISTS garantiza que filas con referentes inexistentes se omitan sin error.

INSERT INTO maestro_sap (clase_costo_id, material_id, proceso_id, tipo_insumo, orden_sap, clasificacion)
SELECT cc.id, m.id, p.id, t.tipo_insumo, t.orden_sap, t.clasificacion
FROM (VALUES
  -- ORD 1 — Trituración
  ('7199990001','CALTLVTRIT', 1,'Caliza',                NULL,     NULL),
  ('7199990001','ARCTLVTRIT', 1,'Arcilla',               NULL,     NULL),
  ('7355250320','BARRAS_PLAC',1,'Barras y Placas',       NULL,     NULL),
  ('7355250321','MAT_DIQUE',  1,'Material Dique',        NULL,     NULL),
  ('7495700001','REGALIAS',   1,'Regalías',              NULL,     NULL),
  ('7405050003','ENERGIA_KWH',1,'Energía',               NULL,     NULL),
  -- ORD 2 — Adiciones
  ('7199990001','CALTLVTRIT', 2,'Caliza',                NULL,     NULL),
  ('7495700001','REGALIAS',   2,'Regalías',              NULL,     NULL),
  ('7199990002','CALIZATRI',  2,'Caliza',                NULL,     NULL),
  ('7355250320','BARRAS_PLAC',2,'Barras y Placas',       NULL,     NULL),
  ('7355250321','MAT_DIQUE',  2,'Material Dique',        NULL,     NULL),
  ('7405050003','ENERGIA_KWH',2,'Energía',               NULL,     NULL),
  -- ORD 3 — Molienda de Crudo
  ('7105330101','CALIZATRI',  3,'Caliza',                '700002', 'CARBON MOLIDO'),
  ('7105330101','CALTLVTRIT', 3,'Caliza',                NULL,     NULL),
  ('7105330101','MEZCPREHO',  3,'Prehomo',               '700003', 'CEMENTO UG'),
  ('7105040101','CORRHIERR',  3,'Mineral de Hierro',     '700004', 'CEMENTO UG 42,5 KG'),
  ('7105040101','CALAMINA',   3,'Mineral de Hierro',     NULL,     NULL),
  ('7355250320','CUERP_MOL',  3,'Cuerpos Moledores',     NULL,     NULL),
  ('7355250321','BARRAS_PLAC',3,'Láminas',               NULL,     NULL),
  ('7355250322','PLAC_SEG',   3,'Anillos, Tapas y Sep.', NULL,     NULL),
  ('7405050003','ENERGIA_KWH',3,'Energía',               NULL,     NULL),
  -- ORD 4 — Molienda de Carbón
  ('7355050103','CARBITUMI',  4,'Carbón',                '700005', 'CALIZA PARA ADICIONES'),
  ('7355050103','CARB_MIXTO', 4,'Carbón',                NULL,     NULL),
  ('7355050103','CARB_FINO',  4,'Carbón',                NULL,     NULL),
  ('7355250320','CUERP_MOL',  4,'Cuerpos Moledores y Lám.',NULL,   NULL),
  ('7355250321','CARGUE_CEM', 4,'Descargue Finos Carbón',NULL,    NULL),
  ('7355250322','VAR_MTTO',   4,'Desatasque de Carbón',  NULL,     NULL),
  ('7355250325','CARGUE_CEM', 4,'Cargador Carbón',       NULL,     NULL),
  ('7405050003','ENERGIA_KWH',4,'Energía',               NULL,     NULL),
  -- ORD 5 — Clinkerización
  ('7199990001','CARBONMOL',  5,'Carbón Molido',         '700006', 'CALIZA EN TOLVA TRITURADORA'),
  ('7199990001','HARINACRUD', 5,'Crudo',                 '700007', 'MEZCLA PREHOMO'),
  ('7355050104','GASOIL',     5,'Gasoil',                '700008', 'ARCILLA EN TOLVA TRITURADORA'),
  ('7355050105','GASOIL',     5,'Gasoil',                '700070', 'COMBUSTIBLES ALTERNOS'),
  ('7199990002','COMBALT',    5,'Combustibles Alternos', NULL,     NULL),
  ('7355250320','VAR_MTTO',   5,'Ductos',                NULL,     NULL),
  ('7355250321','VAR_MTTO',   5,'Enfriador',             NULL,     NULL),
  ('7355250323','VAR_MTTO',   5,'Sellado',               NULL,     NULL),
  ('7355250324','CARGUE_CK',  5,'Cargue Clinker',        NULL,     NULL),
  ('7355250325','CARGUE_CK',  5,'Cargue Ck Tolva',       NULL,     NULL),
  ('7355250322','PLAC_SEG',   5,'Placas',                NULL,     NULL),
  ('7355300105','REFRACTARIO',5,'Refractarios',          NULL,     NULL),
  ('7405050003','ENERGIA_KWH',5,'Energía',               NULL,     NULL),
  -- ORD 6 — Cemento UG
  ('7199990001','CLINKER001', 6,'Clinker',               '700034', 'CEMENTO ART 42,5 KG'),
  ('7105450101','YESO00001',  6,'Yeso',                  '700037', 'CEMENTO ART 50 KG'),
  ('7105330101','CALIZATRI',  6,'Caliza Triturada',      '700040', 'CEMENTO A GRANEL ART'),
  ('7355050105','GASOIL',     6,'Gasoil',                '700080', 'CEMENTO TOPEX 50 KG'),
  ('7105330101','SAL_MARINA', 6,'Sal Marina',            NULL,     NULL),
  ('7105400101','ADIT_MOL',   6,'Aditivo Molienda',      NULL,     NULL),
  ('7105400101','PUZOLANA',   6,'Puzolana',              NULL,     NULL),
  ('7105400101','FINOS_FILT', 6,'Finos Filtro',          NULL,     NULL),
  ('7355250320','PLAC_SEG',   6,'Placas y Segmentos',    NULL,     NULL),
  ('7355250321','VAR_MTTO',   6,'Dosificador de Sal',    NULL,     NULL),
  ('7405050003','ENERGIA_KWH',6,'Energía',               NULL,     NULL),
  -- ORD 7 — Cemento ART
  ('7199990001','CLINKER001', 7,'Clinker',               '700053', 'CEMENTO UG 50 KG'),
  ('7105450101','YESO00001',  7,'Yeso',                  '700055', 'CEMENTO UG 50 KG'),
  ('7105330101','CALIZATRI',  7,'Caliza Triturada',      '700060', 'CEMENTO ART'),
  ('7355050105','GASOIL',     7,'Gasoil',                NULL,     NULL),
  ('7105330101','SAL_MARINA', 7,'Sal Marina',            NULL,     NULL),
  ('7105400101','ADIT_MOL',   7,'Aditivo Molienda',      NULL,     NULL),
  ('7105400101','PUZOLANA',   7,'Puzolana',              NULL,     NULL),
  ('7105400101','FINOS_FILT', 7,'Finos Filtro',          NULL,     NULL),
  ('7355250320','PLAC_SEG',   7,'Placas y Segmentos',    NULL,     NULL),
  ('7355250321','VAR_MTTO',   7,'Dosificador de Sal',    NULL,     NULL),
  ('7405050003','ENERGIA_KWH',7,'Energía',               NULL,     NULL),
  -- ORD 8 — Cemento UG 50 KG
  ('7199990001','CEM_UG',     8,'Cemento UG',            '700050', 'CEMENTO UG 25 KG'),
  ('7360050302','SACO_50KG',  8,'Sacos',                 '700052', 'CEMENTO UG 42,5 KG'),
  ('7405990999','CARGUE_CEM', 8,'Cargue',                NULL,     NULL),
  ('7199990002','CEM_UG_50',  8,'Cemento UG',            NULL,     NULL),
  ('7405050003','ENERGIA_KWH',8,'Energía',               NULL,     NULL),
  -- ORD 9 — Cemento UG 42,5 KG
  ('7199990001','CEM_UG',     9,'Cemento UG',            '700100', 'CEMENTO BIG BAG 1,5 TONELADAS'),
  ('7360050302','SACO_42_5KG',9,'Sacos',                 '700056', 'Cementos'),
  ('7405990999','CARGUE_CEM', 9,'Cargue',                NULL,     NULL),
  ('7199990002','CEM_UG_42',  9,'Cemento UG',            NULL,     NULL),
  ('7105330101','SAL_MARINA', 9,'Sal Marina',            NULL,     NULL),
  ('7405050003','ENERGIA_KWH',9,'Energía',               NULL,     NULL),
  -- ORD 10 — Cemento UG 25 KG
  ('7360050302','SACO_25KG',  10,'Sacos',                '700064', 'FIBROCEMENTO'),
  ('7199990001','CEM_UG',     10,'Cemento UG',           '700120', 'COMBUSTIBLES ALTERNOS'),
  ('7405990999','CARGUE_CEM', 10,'Cargue',               NULL,     NULL),
  ('7199990002','CEM_UG_25',  10,'Cemento UG',           NULL,     NULL),
  ('7405050003','ENERGIA_KWH',10,'Energía',              NULL,     NULL),
  -- ORD 11 — Cemento ART 42,5 KG
  ('7199990001','CEM_ART',    11,'Cemento ART',          '700083', 'CALIZA PARA ADICIONES'),
  ('7360050302','SACO_50KG',  11,'Sacos',                '700036', 'CEMENTO ART 42,5 KG'),
  ('7405990999','CARGUE_CEM', 11,'Cargue',               NULL,     NULL),
  ('7199990002','CEM_ART_42', 11,'Cemento ART',          NULL,     NULL),
  ('7405050003','ENERGIA_KWH',11,'Energía',              NULL,     NULL),
  -- ORD 12 — Cemento a Granel ART
  ('7199990001','CEM_ART',    12,'Cemento ART',          '700090', 'CEMENTO UG TP'),
  ('7405050003','ENERGIA_KWH',12,'Energía',              NULL,     NULL),
  -- ORD 13 — Cemento ART 50 KG
  ('7199990001','CEM_ART',    13,'Cemento ART',          '700091', 'FIBROCEMENTO'),
  ('7405050003','ENERGIA_KWH',13,'Energía',              NULL,     NULL),
  -- ORD 14 — Cemento TOPEX 50 KG
  ('7199990001','CEM_UG_TP',  14,'Cemento UG TP',        NULL,     NULL),
  ('7360050302','SACO_50KG',  14,'Sacos',                NULL,     NULL),
  ('7405990999','CARGUE_CEM', 14,'Cargue',               NULL,     NULL),
  ('7405050003','ENERGIA_KWH',14,'Energía',              NULL,     NULL),
  -- ORD 15 — Cemento UG TP
  ('7199990001','CLINKER001', 15,'Clinker',              NULL,     NULL),
  ('7105450101','YESO00001',  15,'Yeso',                 NULL,     NULL),
  ('7105330101','CALIZATRI',  15,'Caliza Triturada',     NULL,     NULL),
  ('7105330101','SAL_MARINA', 15,'Sal Marina',           NULL,     NULL),
  ('7355050105','GASOIL',     15,'Gasoil',               NULL,     NULL),
  ('7355250320','PLAC_SEG',   15,'Placas y Segmentos',   NULL,     NULL),
  ('7405050003','ENERGIA_KWH',15,'Energía',              NULL,     NULL),
  -- ORD 16 — Fibrocemento
  ('7199990001','CLINKER001', 16,'Clinker',              NULL,     NULL),
  ('7105330101','CALIZATRI',  16,'Caliza Triturada',     NULL,     NULL),
  ('7105450101','YESO00001',  16,'Yeso',                 NULL,     NULL),
  ('7355050105','GASOIL',     16,'Gasoil',               NULL,     NULL),
  ('7105330101','SAL_MARINA', 16,'Sal Marina',           NULL,     NULL),
  ('7105400101','ADIT_MOL',   16,'Aditivo Molienda',     NULL,     NULL),
  ('7105400101','PUZOLANA',   16,'Puzolana',             NULL,     NULL),
  ('7105400101','FINOS_FILT', 16,'Finos Filtro',         NULL,     NULL),
  ('7355250320','PLAC_SEG',   16,'Placas y Segmentos',   NULL,     NULL),
  ('7355250321','VAR_MTTO',   16,'Dosificador de Sal',   NULL,     NULL),
  ('7405050003','ENERGIA_KWH',16,'Energía',              NULL,     NULL),
  -- ORD 19 — Cemento Big Bag
  ('7199990001','CEM_ART',    19,'Cemento ART',          NULL,     NULL),
  ('7360050302','SACO_50KG',  19,'Sacos',                NULL,     NULL),
  ('7405990999','CARGUE_CEM', 19,'Cargue',               NULL,     NULL),
  ('7405050003','ENERGIA_KWH',19,'Energía',              NULL,     NULL),
  -- ORD 20 — Combustibles Alternos
  ('7355050103','COMBALT',    20,'Combustibles Alternos',NULL,     NULL),
  ('7105240101','BRIQUETAS',  20,'Briquetas',            NULL,     NULL),
  ('7105240101','CHIP_MADERA',20,'Chip de Madera',       NULL,     NULL),
  ('7355050101','CDR',        20,'CDR',                  NULL,     NULL),
  ('7355050101','TDF',        20,'Llanta Picada',        NULL,     NULL),
  ('7355250320','CARGUE_CEM', 20,'Cargue Alternos',      NULL,     NULL),
  ('7355250321','CARGUE_CEM', 20,'Descargue Alternos',   NULL,     NULL),
  ('7105400101','CARGUE_CEM', 20,'Empaque y Granel',     NULL,     NULL),
  ('7405050003','ENERGIA_KWH',20,'Energía',              NULL,     NULL),
  -- ORD 21 — Cementos
  ('7405050003','ENERGIA_KWH',21,'Energía',              NULL,     NULL)
) AS t(clase_codigo, mat_codigo, ord, tipo_insumo, orden_sap, clasificacion)
JOIN clases_costo cc ON cc.codigo = t.clase_codigo
JOIN materiales   m  ON m.codigo  = t.mat_codigo
JOIN procesos     p  ON p.ord     = t.ord
ON CONFLICT (clase_costo_id, material_id, proceso_id) DO NOTHING;

-- Verificación rápida (comentar en producción):
-- SELECT count(*) FROM maestro_sap;  -- debe ser >= 120
