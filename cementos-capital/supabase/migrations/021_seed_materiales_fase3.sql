-- Migration 021: ~80 materiales adicionales para Fase 3.
-- Los códigos cortos de migrations 002/018 se mantienen; aquí se agregan
-- variantes con nombres más descriptivos donde el código es distinto.
-- ON CONFLICT (codigo) DO NOTHING — idempotente.

insert into materiales (codigo, nombre, unidad_base, categoria, tipo_insumo, activo) values
  -- ── Materias primas adicionales ──────────────────────────────────────────
  ('CALIZA_MARTILLO_AGR', 'Caliza + Martillo',                          'T',   'materia_prima', 'Caliza',        true),
  ('COSTO_ADIC_MARTILLO', 'Costo Adicional Martillo',                   'T',   'materia_prima', 'Caliza',        true),
  ('CALIZA_EXT_PROV',     'Caliza Comprada a Externos',                 'T',   'materia_prima', 'Caliza',        true),
  ('INTERAMER_CONMINA',   'C I Interamerican Conmina (Fortia Minerals)','T',   'materia_prima', 'Aporte Mineral',true),
  ('ADPR_BRICENO',        'Adpr - Briceño',                             'T',   'materia_prima', 'Aporte ADPR',   true),
  ('ADPR_BELENCITO',      'Adpr - Belencito',                           'T',   'materia_prima', 'Aporte ADPR',   true),
  ('TAP_PAYANDE',         'Tap (Payandé)',                              'T',   'materia_prima', 'Aporte TAP',    true),
  ('CALAM_GERDAU_DIACO',  'Calamina Gerdau - Diaco',                    'T',   'materia_prima', 'Calamina',      true),
  ('CALAM_SIDOC',         'Calamina Sidoc',                             'T',   'materia_prima', 'Calamina',      true),
  ('EXIROS_ATLANTICO',    'Exiros - Atlantico',                         'T',   'materia_prima', 'Aporte Exiros', true),
  ('EXIRO_MANIZALES',     'Exiro - Manizales',                          'T',   'materia_prima', 'Aporte Exiros', true),
  ('ETEX_PROV',           'Etex',                                       'T',   'materia_prima', 'Yeso',          true),
  ('YESO_PRADA',          'Yesos Prada',                                'T',   'materia_prima', 'Yeso',          true),
  ('YESO_REY_MIRANDA',    'Yeso Rey Miranda',                           'T',   'materia_prima', 'Yeso',          true),
  ('SAL_MARINA',          'Sal Marina',                                 'T',   'materia_prima', 'Sal',           true),
  ('PUZ_LA_DORADA',       'Puzolana La Dorada',                         'T',   'materia_prima', 'Puzolana',      true),
  ('MEZCLA_PONDERADO',    'Mezcla Ponderado',                           'T',   'materia_prima', 'Aporte Mezcla', true),

  -- ── Carbón (proveedores) ──────────────────────────────────────────────────
  ('CARBON_SANOHA',       'Sanoha',                                     'T',   'combustible',   'Carbón',        true),
  ('CARBON_FORERO_HZ',    'Forero Hernandez',                           'T',   'combustible',   'Carbón',        true),
  ('CARBON_TOTTAL',       'Tottal Carbón',                              'T',   'combustible',   'Carbón',        true),
  ('CARBON_SOL_COL',      'Soluciones De Carbón Colombia',              'T',   'combustible',   'Carbón',        true),
  ('CARBON_MARGARITAS',   'Minas Las Margaritas',                       'T',   'combustible',   'Carbón',        true),
  ('CARBON_TRANCORA',     'Trancora Sas',                               'T',   'combustible',   'Carbón',        true),
  ('CARBON_ANDINO',       'Mixto Carbones Andino',                      'T',   'combustible',   'Carbón',        true),
  ('CARBON_CARBOCOQUE',   'Mixtos Carbocoque',                          'T',   'combustible',   'Carbón',        true),
  ('CARBON_COQUECOL',     'Mixto Coquecol',                             'T',   'combustible',   'Carbón',        true),
  ('IMPUESTO_CARBON',     'Impuesto Al Carbón',                         'T',   'combustible',   'Carbón',        true),

  -- ── Combustibles alternos adicionales ────────────────────────────────────
  ('CHIPS',               'Chips',                                      'T',   'combustible',   'Alternos',      true),
  ('BRIQUETAS_ARCLAD',    'Briquetas Arclad',                           'T',   'combustible',   'Alternos',      true),
  ('BIOCHIPS_BIOWATT',    'Biochips Biowatt',                           'T',   'combustible',   'Alternos',      true),
  ('CDR_FOCUS_GREEN_ANT', 'Cdr Focus Green Antioquia',                  'T',   'combustible',   'Alternos',      true),
  ('CDR_SIST_VERDE_CUN',  'Cdr Sistema Verde Cundinamarca',             'T',   'combustible',   'Alternos',      true),
  ('CDR_SIST_VERDE_ANT',  'Cdr Sistema Verde Antioquia',                'T',   'combustible',   'Alternos',      true),
  ('CDR_ECOLOGISTICA',    'Cdr Ecologística',                           'T',   'combustible',   'Alternos',      true),
  ('CDR_ECOPOSITIVA',     'Cdr Ecopositiva',                            'T',   'combustible',   'Alternos',      true),
  ('CDR_VEOLIA',          'Cdr Veolia',                                 'T',   'combustible',   'Alternos',      true),
  ('CDR_GDI_CALI',        'Cdr Gdi-Cali',                               'T',   'combustible',   'Alternos',      true),
  ('CDR_GDI_ZIPAQUIRA',   'Cdr Gdi-Zipaquirá',                         'T',   'combustible',   'Alternos',      true),
  ('TDF_SIST_VERDE_CUN',  'Tdf Sistema Verde Cundinamarca',             'T',   'combustible',   'Alternos',      true),
  ('TDF_SIST_VERDE_ANT',  'Tdf Sistema Verde Antioquia',                'T',   'combustible',   'Alternos',      true),
  ('TDF_FOCUS_GREEN_CUN', 'Tdf Focus Green Cundinamarca',               'T',   'combustible',   'Alternos',      true),
  ('DIESEL',              'Diesel',                                     'Gal', 'combustible',   'Diesel',        true),

  -- ── Fletes ───────────────────────────────────────────────────────────────
  ('FLETE_CARB_BOY_SOCHA','Flete (Boyacá - Planta)-Socha',              'T',   'flete',         'Flete Carbón',  true),
  ('FLETE_CARB_BOY',      'Flete Carbón (Boyacá-Planta)',               'T',   'flete',         'Flete Carbón',  true),
  ('FLETE_CARB_ANT',      'Flete Carbón (Antioquia-Planta)',            'T',   'flete',         'Flete Carbón',  true),
  ('FLETE_CARB_CUN',      'Flete Carbón (Cundinamarca-Planta)',         'T',   'flete',         'Flete Carbón',  true),
  ('FLETE_CARB_CAL',      'Flete Carbón (Caldas-Planta)',               'T',   'flete',         'Flete Carbón',  true),
  ('FLETE_CDR_ANT',       'Cdr Flete (Antioquia-Planta)',               'T',   'flete',         'Flete CDR',     true),
  ('FLETE_CDR_CUN',       'Cdr Flete (Cundinamarca-Planta)',            'T',   'flete',         'Flete CDR',     true),
  ('FLETE_CDR_CALI',      'Cdr Flete (Cali-Planta)',                    'T',   'flete',         'Flete CDR',     true),
  ('FLETE_MP_BOY',        'Flete MP (Boyacá-Planta)',                   'T',   'flete',         'Flete MP',      true),
  ('FLETE_MP_CALI',       'Flete MP (Cali-Planta)',                     'T',   'flete',         'Flete MP',      true),
  ('FLETE_MP_BARRANQ',    'Flete MP (Barranquilla-Planta)',             'T',   'flete',         'Flete MP',      true),
  ('FLETE_MP_CART',       'Flete MP (Cartagena-Planta)',                'T',   'flete',         'Flete MP',      true),
  ('FLETE_MP_CUN',        'Flete MP (Cundinamarca-Planta)',             'T',   'flete',         'Flete MP',      true),
  ('FLETE_MP_TOLIMA',     'Flete MP (Tolima-Planta)',                   'T',   'flete',         'Flete MP',      true),
  ('FLETE_MP_MANIZALES',  'Flete MP (Manizales-Planta)',                'T',   'flete',         'Flete MP',      true),
  ('FLETE_YESO_CART',     'Flete Yeso (Cartagena-Planta)',              'T',   'flete',         'Flete Yeso',    true),
  ('FLETE_YESO_MAICAO',   'Flete Yeso (Maicao-Planta)',                 'T',   'flete',         'Flete Yeso',    true),
  ('FLETE_YESO_MS',       'Flete Yeso (Mesa De Los Santos-Planta)',     'T',   'flete',         'Flete Yeso',    true),
  ('FLETE_PUZ_LA_DORADA', 'Flete Puzolana (La Dorada-Planta)',          'T',   'flete',         'Flete Puzolana',true),

  -- ── Repuestos adicionales ─────────────────────────────────────────────────
  ('BARRAS_TRITURADORA',  'Barras Trituradora',                         'T',   'repuesto',      'Trituración',   true),
  ('DUCTOS_HORNO',        'Ductos del Horno',                           'T',   'repuesto',      'Horno',         true),
  ('ENF_PARRILLAS',       'Enfriador de Parrillas/Trituradora',         'T',   'repuesto',      'Horno',         true),
  ('ENF_HORNO',           'Enfriador Horno',                            'T',   'repuesto',      'Horno',         true),
  ('PLACAS_HORNO',        'Placas Horno',                               'T',   'repuesto',      'Horno',         true),
  ('SELLADO_HORNO',       'Elementos Sellados Horno',                   'T',   'repuesto',      'Horno',         true),
  ('REFRACTARIO_HORNO',   'Refractario Horno',                          'T',   'repuesto',      'Horno',         true),
  ('MASAS_MOLINO_CRUDO',  'Masas Molino Crudo',                         'T',   'repuesto',      'Molino Crudo',  true),
  ('LAMINAS_CRUDO',       'Láminas Crudo',                              'T',   'repuesto',      'Molino Crudo',  true),
  ('MASAS_MOLINO_CARBON', 'Masas Molino Carbón',                        'T',   'repuesto',      'Molino Carbón', true),
  ('ANI_TAP_SEP_CRUDO',   'Anillos/Tapas/Separadores Crudo',            'T',   'repuesto',      'Molino Crudo',  true),
  ('PLAC_SEG_ROD_CEM',    'Placas y Segmentos Rodillo Cemento',         'T',   'repuesto',      'Molino Cemento',true),
  ('EMPAQUE_CEM',         'Empaque Cemento',                            'T',   'repuesto',      'Empaque',       true),
  ('VARIABLES_MTTO',      'Variables Mtto',                             'T',   'repuesto',      'Mtto Variable', true),

  -- ── Servicios adicionales ─────────────────────────────────────────────────
  ('DESC_FINOS_MINI',     'Descargue Finos (Mini)',                     'T',   'servicio',      'Operación Carbón',   true),
  ('DESC_ALTERNOS',       'Descargue de Alternos',                      'T',   'servicio',      'Operación Alternos', true),
  ('CARG_ALTERNOS',       'Cargue de Alternos',                         'T',   'servicio',      'Operación Alternos', true),
  ('CARGADOR_CARBON',     'Cargador Carbón',                            'T',   'servicio',      'Operación Carbón',   true),
  ('DESATASQUE_CARB',     'Desatasque de Carbón',                       'Mes', 'servicio',      'Operación Carbón',   true),
  ('DESC_MP',             'Descargue MP',                               'T',   'servicio',      'Operación MP',       true),
  ('CARG_CK_TOLVA',       'Cargue Clinker (En Tolva)',                  'T',   'servicio',      'Operación Clinker',  true),
  ('CARG_CK_VENTA',       'Cargue Clinker Venta',                       'T',   'servicio',      'Operación Clinker',  true),
  ('DOSIFIC_SAL',         'Dosificación Sal',                           'T',   'servicio',      'Operación Cemento',  true),
  ('EMP_GRANEL',          'Empaque y Granel',                           'T',   'servicio',      'Operación Empaque',  true),
  ('EMP_UNITARIO',        'Unitario Empaque y Granel',                  'Saco','servicio',      'Operación Empaque',  true),
  ('EMP_FIJO_HE',         'Fijo + Horas Extras Empaque',                'Mes', 'servicio',      'Operación Empaque',  true),

  -- ── Empaques nuevos ───────────────────────────────────────────────────────
  ('SACO_50KG_TOPEX',     'Saco 50 Kg Topex',                           'UN',  'empaque',       'Saco',          true),
  ('SACO_42KG_ART',       'Saco 42,5 Kg ART',                           'UN',  'empaque',       'Saco',          true),

  -- ── Aditivos adicionales ──────────────────────────────────────────────────
  ('ADITIVO_CEMENTO',     'Aditivo Cemento',                            'Kgr', 'aditivo',       'Aditivo',       true),

  -- ── Regalías adicionales ──────────────────────────────────────────────────
  ('REGALIAS_ARCILLA',    'Regalías Arcilla',                           'T',   'regalia',       'Mina Arcilla',  true),
  ('REGALIAS_CALIZA',     'Regalías Caliza',                            'T',   'regalia',       'Mina Caliza',   true)

on conflict (codigo) do nothing;

-- Verificación
do $$
declare
  n int;
begin
  select count(*) into n from materiales;
  raise notice 'Total materiales después de migración 021: %', n;
  if n < 120 then
    raise exception 'Esperado >= 120 materiales, encontrados %. Verificar seed.', n;
  end if;
end $$;
