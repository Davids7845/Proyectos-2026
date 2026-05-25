-- =========================================================
-- SEED: material_aliases
-- Mapea los nombres exactos del Excel (sección Precios) a los
-- códigos canónicos de la tabla `materiales`.
-- Ejecutar en Supabase SQL Editor. Idempotente (ON CONFLICT DO NOTHING).
-- =========================================================

-- Asegurar GRANT (por si no se aplicó en migration 004)
GRANT SELECT ON material_aliases TO authenticated, anon;
GRANT ALL    ON material_aliases TO service_role;

INSERT INTO material_aliases (alias, material_id, notas)
SELECT alias, m.id, notas
FROM (VALUES
  -- ── Yeso (proveedores) ──────────────────────────────────
  ('Yeso Rey Miranda',                'YESO00001', 'Proveedor Yeso'),
  ('Yesos Prada',                     'YESO00001', 'Proveedor Yeso'),

  -- ── Puzolana (proveedores / variantes) ──────────────────
  ('Puzolana La Dorada',              'PUZOLANA',  'Variante Puzolana'),

  -- ── TDF – Neumáticos (proveedores) ──────────────────────
  ('Tdf',                             'TDF',       'Alias corto TDF'),
  ('Tdf Focus Green Cundinamarca',    'TDF',       'Proveedor TDF'),
  ('Tdf Sistema Verde Antioquia',     'TDF',       'Proveedor TDF'),
  ('Tdf Sistema Verde Cundinamarca',  'TDF',       'Proveedor TDF'),

  -- ── CDR – Combustible Derivado Residuo (proveedores) ────
  ('Cdr',                             'CDR',       'Alias corto CDR'),
  ('Cdr Ecologística',                'CDR',       'Proveedor CDR'),
  ('Cdr Ecopositiva',                 'CDR',       'Proveedor CDR'),
  ('Cdr Flete (Antioquia - Planta)',  'CDR',       'Flete CDR Antioquia'),
  ('Cdr Flete (Cali - Planta)',       'CDR',       'Flete CDR Cali'),
  ('Cdr Flete (Cundinamarca - Planta)','CDR',      'Flete CDR Cundinamarca'),
  ('Cdr Focus Green Antioquia',       'CDR',       'Proveedor CDR'),
  ('Cdr Gdi-Cali',                    'CDR',       'Proveedor CDR'),
  ('Cdr Gdi-Zipaquirá',               'CDR',       'Proveedor CDR'),
  ('Cdr Sistema Verde  Cundinamarca', 'CDR',       'Proveedor CDR'),
  ('Cdr Sistema Verde Antioquia',     'CDR',       'Proveedor CDR'),
  ('Cdr Veolia',                      'CDR',       'Proveedor CDR'),

  -- ── Briquetas / Biomasa (proveedores / variantes) ───────
  ('Briquetas Arclad',                'BRIQUETAS', 'Proveedor Briquetas'),
  ('Biochips Biowatt',                'BRIQUETAS', 'Biomasa → Briquetas'),
  ('Chips',                           'BRIQUETAS', 'Biomasa → Briquetas'),
  ('Sanoha',                          'BRIQUETAS', 'Proveedor Briquetas/Biomasa'),
  ('Etex',                            'BRIQUETAS', 'Proveedor Briquetas/Biomasa'),
  ('Exiro - Manizales',               'BRIQUETAS', 'Proveedor Biomasa'),
  ('Exiros - Atlantico',              'BRIQUETAS', 'Proveedor Biomasa'),
  ('Trancora Sas',                    'BRIQUETAS', 'Proveedor Biomasa'),

  -- ── Carbón Mixto (proveedores) ───────────────────────────
  ('Mixto Carbones Andino',           'CARB_MIXTO','Proveedor Carbón Mixto'),
  ('Mixto Coquecol',                  'CARB_MIXTO','Proveedor Carbón Mixto'),
  ('Mixtos Carbocoque',               'CARB_MIXTO','Proveedor Carbón Mixto'),

  -- ── Carbón Bituminoso (proveedores) ──────────────────────
  ('C I Interamerican Conmina (Fortia Minerals)', 'CARBITUMI', 'Proveedor Carbón'),
  ('Soluciones De Carbón Colombia',   'CARBITUMI', 'Proveedor Carbón'),
  ('Minas Las Margaritas',            'CARBITUMI', 'Proveedor Carbón'),
  ('Forero Hernandez',                'CARBITUMI', 'Proveedor Carbón'),
  ('Tap (Payandé)',                    'CARBITUMI', 'Proveedor Carbón'),
  ('Tottal Carbón',                   'CARBITUMI', 'Proveedor Carbón'),
  ('Adpr - Belencito',                'CARBITUMI', 'Proveedor Carbón'),
  ('Adpr - Briceño',                  'CARBITUMI', 'Proveedor Carbón'),
  ('Impuesto Al Carbón',              'CARBITUMI', 'Impuesto sobre carbón'),

  -- ── Sacos (variantes por producto) ───────────────────────
  ('Sacos 50 Kg Ug',                  'SACO_50KG', 'Saco 50 kg UG'),
  ('Sacos 50 Kg Topex',               'SACO_50KG', 'Saco 50 kg Topex'),
  ('Sacos 42,5 Kg Ug',                'SACO_42_5KG','Saco 42,5 kg UG'),
  ('Sacos 42,5 Kg Art',               'SACO_42_5KG','Saco 42,5 kg ART'),
  ('Sacos 25 Kg',                     'SACO_25KG', 'Saco 25 kg'),

  -- ── Caliza (variantes / proveedores) ─────────────────────
  ('Caliza Explotada',                'CALTLVTRIT','Caliza explotada en cantera'),
  ('Caliza Comprada a Externos',      'CALIZATRI', 'Caliza comprada'),
  ('Caliza + Martillo',               'CALIZATRI', 'Caliza incluye costo martillo'),
  ('Costo Adicional Martillo',        'CALIZATRI', 'Costo martillo sobre caliza'),

  -- ── Arcilla ──────────────────────────────────────────────
  ('Arcilla Explotada',               'ARCTLVTRIT','Arcilla explotada en cantera'),

  -- ── Calamina (proveedores) ────────────────────────────────
  ('Calamina Gerdau - Diaco',         'CALAMINA',  'Proveedor Calamina'),
  ('Calamina Sidoc',                  'CALAMINA',  'Proveedor Calamina'),

  -- ── Cargue Clinker (variantes) ────────────────────────────
  ('Cargue Clinker Pm(En La Tolva)',  'CARGUE_CK', 'Cargue clinker patio/molino'),
  ('Cargue Clinker Venta',            'CARGUE_CK', 'Cargue clinker venta'),
  ('Cargue De Alternos',              'CARGUE_CK', 'Cargue combustibles alternos'),

  -- ── Empaque y Cargue Cemento ──────────────────────────────
  ('Empaque Cemento',                 'CARGUE_CEM','Empaque cemento'),
  ('Empaque y Granel',                'CARGUE_CEM','Empaque y despacho granel'),
  ('Fijo + Horas Extras Empaque y Granel','CARGUE_CEM','Mano de obra empaque'),
  ('Unitario Empaque y Granel',       'CARGUE_CEM','Costo unitario empaque'),

  -- ── Aditivos ──────────────────────────────────────────────
  ('Aditivo Cemento',                 'ADIT_MOL',  'Aditivo para molienda cemento'),
  ('Sal Marina',                      'ADIT_MOL',  'Sal marina como aditivo'),
  ('Dosificacion Sal',                'ADIT_MOL',  'Dosificación sal marina'),

  -- ── Diesel / Gasoil ──────────────────────────────────────
  ('Diesel',                          'GASOIL',    'Alias Diesel = Gasoil'),

  -- ── Regalías (variantes) ──────────────────────────────────
  ('Precio Regalías Caliza',          'REGALIAS',  'Regalías sobre caliza'),
  ('Precio Regalías Arcilla',         'REGALIAS',  'Regalías sobre arcilla'),

  -- ── Refractarios (variantes) ──────────────────────────────
  ('Refractario Horno',               'REFRACTARIO','Refractario horno cementero'),
  ('Ductos Del Horno',                'REFRACTARIO','Ductos refractarios horno'),
  ('Elementos Sellados Horno',        'REFRACTARIO','Sellos horno refractario'),
  ('Enfriador Horno',                 'REFRACTARIO','Componentes enfriador horno'),
  ('Placas Horno',                    'REFRACTARIO','Placas refractarias horno'),

  -- ── Cuerpos Moledores ─────────────────────────────────────
  ('Masas Molino Carbón',             'CUERP_MOL', 'Masas moledoras molino carbón'),
  ('Masas Molino Crudo',              'CUERP_MOL', 'Masas moledoras molino crudo'),

  -- ── Placas y Segmentos ────────────────────────────────────
  ('Anillos/Tapas/Separadores Crudo', 'PLAC_SEG',  'Anillos separadores molino crudo'),
  ('Láminas Crudo',                   'PLAC_SEG',  'Láminas molino crudo'),
  ('Placas Y Segmentos Rodillo Cemento','PLAC_SEG', 'Placas y segmentos cemento'),

  -- ── Barras y Placas ───────────────────────────────────────
  ('Barras Trituradora',              'BARRAS_PLAC','Barras desgaste trituradora'),
  ('Enfriador De Parrillas/Triturad', 'BARRAS_PLAC','Parrillas enfriador/trituradora'),

  -- ── Variable Mantenimiento (servicios operativos) ─────────
  ('Desatasque De Carbón',            'VAR_MTTO',  'Servicio desatasque carbón'),
  ('Descarge Finos (Mini)',           'VAR_MTTO',  'Descargue finos mini-loader'),
  ('Descargue De Alternos',          'VAR_MTTO',  'Descargue combustibles alternos'),
  ('Descargue Mp''S',                 'VAR_MTTO',  'Descargue materias primas'),
  ('Cargador Carbón',                 'VAR_MTTO',  'Operación cargador carbón'),
  ('Tarifa Alternos',                 'VAR_MTTO',  'Tarifa manejo alternos'),
  ('Tarifa Desatasque',               'VAR_MTTO',  'Tarifa servicio desatasque'),
  ('Horas Alternos',                  'VAR_MTTO',  'Horas operación alternos'),

  -- ── Fletes (CD → VAR_MTTO como costo logístico) ──────────
  ('Flete (Antioquia - Planta)',      'VAR_MTTO',  'Flete carbón Antioquia'),
  ('Flete (Barranquilla - Planta)',   'VAR_MTTO',  'Flete Barranquilla'),
  ('Flete (Boyacá - Planta)',         'VAR_MTTO',  'Flete Boyacá'),
  ('Flete (Boyacá - Planta)-Socha',   'VAR_MTTO',  'Flete Boyacá Socha'),
  ('Flete (Caldas - Planta)',         'VAR_MTTO',  'Flete Caldas'),
  ('Flete (Cali - Planta)',           'VAR_MTTO',  'Flete Cali'),
  ('Flete (Cartagena - Planta)',      'VAR_MTTO',  'Flete Cartagena'),
  ('Flete (Cartagena Planta)',        'VAR_MTTO',  'Flete Cartagena alt'),
  ('Flete (Cundinamarca - Planta)',   'VAR_MTTO',  'Flete Cundinamarca'),
  ('Flete (La Dorada A Planta)',      'VAR_MTTO',  'Flete La Dorada'),
  ('Flete (Maicao - Planta)',         'VAR_MTTO',  'Flete Maicao'),
  ('Flete (Manizales - Planta)',      'VAR_MTTO',  'Flete Manizales'),
  ('Flete (Mesa De Los Santos A Planta)','VAR_MTTO','Flete Mesa Santos'),
  ('Flete (Tolima  - Planta)',        'VAR_MTTO',  'Flete Tolima'),

  -- ── Mezcla Ponderado ──────────────────────────────────────
  ('Mezcla Ponderado',               'MEZCPREHO', 'Mezcla prehomo ponderada'),

  -- ── Material Dique (Mining Dique) ────────────────────────
  ('Material Dique',                  'MAT_DIQUE', 'Alias exacto Material Dique'),

  -- ── Productos terminados (para recetas) ───────────────────
  ('Granel Ug',                        'CEM_UG',      'Cemento UG granel'),
  ('Granel Art',                       'CEM_ART',     'Cemento ART granel'),
  ('Topex Ug',                         'CEM_TOPEX',   'Cemento Topex 50 kg'),
  ('Cemento Bigbag 1.5 T',             'CEM_BIGBAG',  'Big Bag 1,5 T'),
  ('Cemento Big Bag 1,5 T',            'CEM_BIGBAG',  'Big Bag 1,5 T alt'),
  ('Cemento Big Bag 1.5 Toneladas',    'CEM_BIGBAG',  'Big Bag 1,5 T variante'),
  ('Cemento Total',                    'CEM_UG',      'Cemento Total → UG genérico'),

  -- ── Semielaborados (para recetas) ─────────────────────────
  ('Clinker A Tolva',                  'CLINKER001',  'Clinker a tolva molienda'),
  ('Clinker',                          'CLINKER001',  'Alias directo Clinker'),
  ('Harina Cruda',                     'HARINACRUD',  'Harina cruda molino'),
  ('Mezcla Prehomo',                   'MEZCPREHO',   'Mezcla prehomogeneización'),
  ('Carbon Molido',                    'CARBONMOL',   'Carbón molido'),
  ('Carbón Molido',                    'CARBONMOL',   'Carbón molido con tilde'),
  ('Carbón Molido En Horno',           'CARBONMOL',   'Carbón molido aplicado horno'),

  -- ── Finos (residuos proceso) ─────────────────────────────
  ('Finos De Carbón',                  'CARB_FINO',   'Finos de carbón'),
  ('Finos De Carbon',                  'CARB_FINO',   'Finos de carbón sin tilde'),
  ('Finos De Crudo',                   'FINOS_FILT',  'Finos de crudo'),
  ('Finos Filtro',                     'FINOS_FILT',  'Finos de filtro'),

  -- ── Herramientas / otros ──────────────────────────────────
  ('Martillo',                         'CALIZATRI',   'Costo martillo → caliza'),
  ('Caliza Para Adiciones',            'CALIZATRI',   'Caliza para adiciones'),
  ('Mineral De Hierro',                'CORRHIERR',   'Mineral de hierro'),
  ('Combustibles Alternos',            'CDR',         'Combustibles alternos genérico')

) AS t(alias, codigo, notas)
JOIN materiales m ON m.codigo = t.codigo
ON CONFLICT (lower(alias)) DO NOTHING;

-- Verificar cuántos alias quedaron sin insertar
-- (si algún código no existe en materiales, ese INSERT se omite silenciosamente)
SELECT count(*) AS aliases_insertados FROM material_aliases;
