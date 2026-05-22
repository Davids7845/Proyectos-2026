-- =========================================================
-- SEED: PROCESOS (ORD) — extraídos directamente del Excel
-- orden_topologico: 1=primero (sin dependencias), mayor=más tarde
-- =========================================================
insert into procesos (ord, material, nombre, orden_topologico) values
  (1,  'MEZCLA PREHOMO',                   'Trituración',               1),
  (2,  'CALIZA PARA ADICIONES',            'Adiciones',                 2),
  (4,  'CARBON MOLIDO',                    'Molienda de Carbón',        3),
  (20, 'COMBUSTIBLES ALTERNOS',            'Combustibles Alternos',     4),
  (3,  'HARINA CRUDA',                     'Molienda de Crudo',         5),
  (5,  'CLINKER',                          'Clinkerización',            6),
  (6,  'CEMENTO UG',                       'Cemento UG',                7),
  (7,  'CEMENTO ART',                      'Cemento ART',               8),
  (16, 'FIBROCEMENTO',                     'Fibrocemento',              9),
  (8,  'CEMENTO UG 50 KG',                 'CEMENTO UG 50 KG',          10),
  (9,  'CEMENTO UG 42,5 KG',               'CEMENTO UG 42,5 KG',        11),
  (10, 'CEMENTO UG 25 KG',                 'CEMENTO UG 25 KG',          12),
  (11, 'CEMENTO ART 42,5 KG',              'CEMENTO ART 42,5 KG',       13),
  (14, 'CEMENTO TOPEX 50 KG',              'CEMENTO TOPEX 50 KG',       14),
  (15, 'CEMENTO UG TP',                    'Cemento UG TP',             15),
  (19, 'CEMENTO BIG BAG 1,5 TONELADAS',    'CEMENTO BIG BAG 1,5 TONELADAS', 16),
  (21, 'CEMENTOS',                         'Cementos',                  17);

-- =========================================================
-- SEED: CLASES DE COSTO SAP (más frecuentes del Maestro)
-- =========================================================
insert into clases_costo (codigo, denominacion, tipo) values
  ('7199990001', 'CONSUMOS SEMIELABORADOS',     'SEMIELABORADO'),
  ('7999999995', 'TRASLADOS DE COSTOS',         'TRASLADO'),
  ('7405050003', 'ENERGÍA',                     'ENERGIA'),
  ('7355250320', 'REPUESTOS',                   'REPUESTOS'),
  ('7105330101', 'CTO. MP CALIZAS NAL',         'MP'),
  ('7105040101', 'MP CORRECT HIERO NAL',        'MP'),
  ('7355050103', 'CTO COMBUS SOL NAC',          'COMBUSTIBLE'),
  ('7355050104', 'CTO COMBUS GAS NAC',          'COMBUSTIBLE'),
  ('7355050105', 'CTO COMBUS LIQ NAC',          'COMBUSTIBLE'),
  ('7105450101', 'CTO. MP YES/ESCA NAL',        'MP'),
  ('7105060101', 'MP CORR ARCILLA NAL',         'MP'),
  ('7105070101', 'CTO MP PUZOLANA NAL',         'MP'),
  ('7105080001', 'CTO MP YESO NAL',             'MP'),
  ('7355190001', 'REFRACTARIOS',                'REPUESTOS'),
  ('7355200001', 'CUERPOS MOLEDORES',           'REPUESTOS'),
  ('7405060001', 'SERVICIOS INDUSTRIALES',      'SERVICIO'),
  ('7405070001', 'FLETES',                      'SERVICIO');

-- =========================================================
-- SEED: MATERIALES (insumos del Excel, normalizados)
-- =========================================================
insert into materiales (codigo, nombre, unidad_base, categoria, tipo_insumo) values
  -- Materias primas minerales
  ('CALIZATRI',    'Caliza Triturada',              'T',    'materia_prima',  'Caliza'),
  ('CALTLVTRIT',   'Caliza en Prehomo (Explotada)', 'T',    'materia_prima',  'Caliza'),
  ('ARCTLVTRIT',   'Arcilla en Prehomo (Explotada)','T',    'materia_prima',  'Arcilla'),
  ('CORRHIERR',    'Mineral de Hierro',             'T',    'materia_prima',  'Mineral de Hierro'),
  ('CALAMINA',     'Calamina',                      'T',    'materia_prima',  'Calamina'),
  ('YESO00001',    'Yeso',                          'T',    'materia_prima',  'Yeso'),
  ('PUZOLANA',     'Puzolana',                      'T',    'materia_prima',  'Puzolana'),
  ('ADIT_MOL',     'Aditivo Molienda',              'T',    'materia_prima',  'Aditivo'),
  ('FINOS_FILT',   'Finos Filtro',                  'T',    'materia_prima',  'Finos'),
  -- Semielaborados
  ('MEZCPREHO',    'Mezcla Prehomo',                'T',    'semielaborado',  'Prehomo'),
  ('HARINACRUD',   'Harina Cruda',                  'T',    'semielaborado',  'Crudo'),
  ('CARBONMOL',    'Carbón Molido',                 'T',    'semielaborado',  'Carbón Molido'),
  ('CLINKER001',   'Clinker',                       'T',    'semielaborado',  'Clinker'),
  -- Combustibles
  ('CARBITUMI',    'Carbón Bituminoso',             'T',    'combustible',    'Carbón'),
  ('CARB_MIXTO',   'Carbón Mixto',                  'T',    'combustible',    'Carbón'),
  ('CARB_FINO',    'Carbón Fino',                   'T',    'combustible',    'Carbón'),
  ('CDR',          'CDR (Combustible Derivado Residuo)', 'T', 'combustible',  'Alternos'),
  ('TDF',          'TDF (Neumáticos)',              'T',    'combustible',    'Alternos'),
  ('BRIQUETAS',    'Briquetas',                     'T',    'combustible',    'Alternos'),
  ('GASOIL',       'Gasoil',                        'Gal',  'combustible',    'Gasoil'),
  -- Energía
  ('ENERGIA_KWH',  'Energía Eléctrica',             'kWh',  'energia',        'Energía'),
  -- Empaque
  ('SACO_50KG',    'Saco 50 kg',                    'UN',   'empaque',        'Saco'),
  ('SACO_42_5KG',  'Saco 42,5 kg',                  'UN',   'empaque',        'Saco'),
  ('SACO_25KG',    'Saco 25 kg',                    'UN',   'empaque',        'Saco'),
  -- Productos terminados
  ('CEM_UG',       'Cemento UG (Granel)',           'T',    'producto',       'Cemento UG'),
  ('CEM_UG_50',    'Cemento UG 50 kg',              'T',    'producto',       'Cemento UG'),
  ('CEM_UG_42',    'Cemento UG 42,5 kg',            'T',    'producto',       'Cemento UG'),
  ('CEM_UG_25',    'Cemento UG 25 kg',              'T',    'producto',       'Cemento UG'),
  ('CEM_UG_TP',    'Cemento UG TP',                 'T',    'producto',       'Cemento UG'),
  ('CEM_ART',      'Cemento ART (Granel)',          'T',    'producto',       'Cemento ART'),
  ('CEM_ART_42',   'Cemento ART 42,5 kg',           'T',    'producto',       'Cemento ART'),
  ('CEM_TOPEX',    'Cemento Topex 50 kg',           'T',    'producto',       'Cemento Topex'),
  ('FIBROCEMENTO', 'Fibrocemento',                  'T',    'producto',       'Fibrocemento'),
  ('CEM_BIGBAG',   'Cemento Big Bag 1,5 T',         'T',    'producto',       'Big Bag'),
  -- Servicios / otros
  ('BARRAS_PLAC',  'Barras y Placas',               'UN',   'repuesto',       'Desgaste'),
  ('MAT_DIQUE',    'Material Dique',                'T',    'servicio',       'Mina'),
  ('REGALIAS',     'Regalías',                      'T',    'servicio',       'Mina'),
  ('CARGUE_CK',    'Cargue Clinker',                'T',    'servicio',       'Cargue'),
  ('CARGUE_CEM',   'Empaque y Cargue Cemento',      'T',    'servicio',       'Cargue'),
  ('VAR_MTTO',     'Variable Mantenimiento',        'T',    'servicio',       'Mantenimiento'),
  ('REFRACTARIO',  'Refractarios',                  'T',    'repuesto',       'Refractarios'),
  ('CUERP_MOL',    'Cuerpos Moledores',             'T',    'repuesto',       'Desgaste'),
  ('PLAC_SEG',     'Placas y Segmentos',            'T',    'repuesto',       'Desgaste');
