-- Migration 018: Agrega ~80 materiales faltantes para cubrir la hoja "Costo"
-- del Excel Nueva_Plantilla_Ppto_CV_V2.xlsx completa.
-- Usa ON CONFLICT (codigo) DO NOTHING para ser idempotente.

insert into materiales (codigo, nombre, unidad_base, categoria, tipo_insumo) values
  -- A.1 Materias primas / minerales
  ('CALIZAEXT',   'Caliza Comprada a Externos',                      'T',   'materia_prima', 'Caliza'),
  ('COST_MART',   'Costo Adicional Martillo',                        'T',   'materia_prima', 'Caliza'),
  ('PUZ_DORADA',  'Puzolana La Dorada',                             'T',   'materia_prima', 'Puzolana'),
  ('YESO_PRADA',  'Yesos Prada',                                    'T',   'materia_prima', 'Yeso'),
  ('YESO_MIRAND', 'Yeso Rey Miranda',                               'T',   'materia_prima', 'Yeso'),
  ('SAL_MARINA',  'Sal Marina',                                     'T',   'materia_prima', 'Sal'),
  ('CALAM_GERDA', 'Calamina Gerdau - Diaco',                        'T',   'materia_prima', 'Calamina'),
  ('CALAM_SIDOC', 'Calamina Sidoc',                                 'T',   'materia_prima', 'Calamina'),
  ('ADPR_BRICEN', 'Adpr - Briceño',                                 'T',   'materia_prima', 'Aporte ADPR'),
  ('ADPR_BELENC', 'Adpr - Belencito',                               'T',   'materia_prima', 'Aporte ADPR'),
  ('TAP_PAYANDE', 'Tap (Payandé)',                                   'T',   'materia_prima', 'Aporte TAP'),
  ('EXIROS_ATL',  'Exiros - Atlantico',                             'T',   'materia_prima', 'Aporte Exiros'),
  ('EXIROS_MAN',  'Exiro - Manizales',                              'T',   'materia_prima', 'Aporte Exiros'),
  ('INTERAMER',   'C I Interamerican Conmina (Fortia Minerals)',    'T',   'materia_prima', 'Aporte'),
  ('ETEX',        'Etex',                                           'T',   'materia_prima', 'Yeso'),

  -- A.2 Combustibles sólidos — proveedores de carbón
  ('CARB_SANOHA', 'Carbón Sanoha',                                  'T',   'combustible',   'Carbón'),
  ('CARB_FOREHE', 'Carbón Forero Hernandez',                        'T',   'combustible',   'Carbón'),
  ('CARB_TOTTAL', 'Carbón Tottal',                                  'T',   'combustible',   'Carbón'),
  ('CARB_SOLUCI', 'Carbón Soluciones Colombia',                     'T',   'combustible',   'Carbón'),
  ('CARB_LASMAR', 'Carbón Minas Las Margaritas',                    'T',   'combustible',   'Carbón'),
  ('CARB_TRANCO', 'Carbón Trancora Sas',                            'T',   'combustible',   'Carbón'),
  ('CARB_ANDINO', 'Mixto Carbones Andino',                          'T',   'combustible',   'Carbón'),
  ('CARB_COQUEC', 'Mixto Carbocoque',                               'T',   'combustible',   'Carbón'),
  ('CARB_COQUEL', 'Mixto Coquecol',                                 'T',   'combustible',   'Carbón'),
  ('IMP_CARBON',  'Impuesto al Carbón',                             'T',   'combustible',   'Carbón'),

  -- A.3 Combustibles alternos
  ('CHIPS',       'Chips',                                          'T',   'combustible',   'Alternos'),
  ('BRIQ_ARCLAD', 'Briquetas Arclad',                               'T',   'combustible',   'Alternos'),
  ('BIOCHIPS',    'Biochips Biowatt',                               'T',   'combustible',   'Alternos'),
  ('MEZCLA_POND', 'Mezcla Ponderado',                               'T',   'combustible',   'Alternos'),
  ('CDR_FG_ANT',  'CDR Focus Green Antioquia',                      'T',   'combustible',   'Alternos'),
  ('CDR_SV_CUN',  'CDR Sistema Verde Cundinamarca',                 'T',   'combustible',   'Alternos'),
  ('CDR_SV_ANT',  'CDR Sistema Verde Antioquia',                    'T',   'combustible',   'Alternos'),
  ('CDR_ECOLOG',  'CDR Ecologística',                               'T',   'combustible',   'Alternos'),
  ('CDR_ECOPOS',  'CDR Ecopositiva',                                'T',   'combustible',   'Alternos'),
  ('CDR_VEOLIA',  'CDR Veolia',                                     'T',   'combustible',   'Alternos'),
  ('CDR_GDI_CAL', 'CDR Gdi-Cali',                                   'T',   'combustible',   'Alternos'),
  ('CDR_GDI_ZIP', 'CDR Gdi-Zipaquirá',                              'T',   'combustible',   'Alternos'),
  ('TDF_SV_CUN',  'TDF Sistema Verde Cundinamarca',                 'T',   'combustible',   'Alternos'),
  ('TDF_SV_ANT',  'TDF Sistema Verde Antioquia',                    'T',   'combustible',   'Alternos'),
  ('TDF_FG_CUN',  'TDF Focus Green Cundinamarca',                   'T',   'combustible',   'Alternos'),
  ('DIESEL',      'Diesel',                                         'Gal', 'combustible',   'Diesel'),

  -- A.4 Fletes / transporte
  ('FLE_CARB_BS', 'Flete Carbón (Boyacá-Planta) Socha',            'T',   'flete',         'Flete'),
  ('FLE_CARB_BO', 'Flete Carbón (Boyacá-Planta)',                   'T',   'flete',         'Flete'),
  ('FLE_CARB_AN', 'Flete Carbón (Antioquia-Planta)',                'T',   'flete',         'Flete'),
  ('FLE_CARB_CU', 'Flete Carbón (Cundinamarca-Planta)',             'T',   'flete',         'Flete'),
  ('FLE_CARB_CL', 'Flete Carbón (Caldas-Planta)',                   'T',   'flete',         'Flete'),
  ('FLE_CDR_AN',  'Flete CDR (Antioquia-Planta)',                   'T',   'flete',         'Flete'),
  ('FLE_CDR_CU',  'Flete CDR (Cundinamarca-Planta)',                'T',   'flete',         'Flete'),
  ('FLE_CDR_CA',  'Flete CDR (Cali-Planta)',                        'T',   'flete',         'Flete'),
  ('FLE_MP_BO',   'Flete MP (Boyacá-Planta)',                       'T',   'flete',         'Flete'),
  ('FLE_MP_CA',   'Flete MP (Cali-Planta)',                         'T',   'flete',         'Flete'),
  ('FLE_MP_BA',   'Flete MP (Barranquilla-Planta)',                 'T',   'flete',         'Flete'),
  ('FLE_MP_CT',   'Flete MP (Cartagena-Planta)',                    'T',   'flete',         'Flete'),
  ('FLE_MP_CU',   'Flete MP (Cundinamarca-Planta)',                 'T',   'flete',         'Flete'),
  ('FLE_MP_TO',   'Flete MP (Tolima-Planta)',                       'T',   'flete',         'Flete'),
  ('FLE_MP_MA',   'Flete MP (Manizales-Planta)',                    'T',   'flete',         'Flete'),
  ('FLE_YESO_CT', 'Flete Yeso (Cartagena-Planta)',                  'T',   'flete',         'Flete'),
  ('FLE_YESO_MA', 'Flete Yeso (Maicao-Planta)',                     'T',   'flete',         'Flete'),
  ('FLE_YESO_MS', 'Flete Yeso (Mesa Santos-Planta)',                'T',   'flete',         'Flete'),
  ('FLE_PUZ_DOR', 'Flete Puzolana (La Dorada-Planta)',              'T',   'flete',         'Flete'),

  -- A.5 Repuestos
  ('BARRAS_TRIT', 'Barras Trituradora',                             'T',   'repuesto',      'Desgaste'),
  ('DUCT_HORNO',  'Ductos del Horno',                               'T',   'repuesto',      'Horno'),
  ('ENFR_PARRIL', 'Enfriador Parrillas/Trituradora',                'T',   'repuesto',      'Horno'),
  ('ENFR_HORNO',  'Enfriador Horno',                                'T',   'repuesto',      'Horno'),
  ('PLAC_HORNO',  'Placas Horno',                                   'T',   'repuesto',      'Horno'),
  ('SELLADO_HRN', 'Elementos Sellados Horno',                       'T',   'repuesto',      'Horno'),
  ('REFR_HORNO',  'Refractario Horno',                              'T',   'repuesto',      'Horno'),
  ('MASAS_CRUDO', 'Masas Molino Crudo',                             'T',   'repuesto',      'Molino'),
  ('LAM_CRUDO',   'Láminas Crudo',                                  'T',   'repuesto',      'Molino'),
  ('MASAS_CARB',  'Masas Molino Carbón',                            'T',   'repuesto',      'Molino'),
  ('ANI_TAP_SEP', 'Anillos/Tapas/Separadores Crudo',               'T',   'repuesto',      'Molino'),
  ('PLAC_SEG_CEM','Placas y Segmentos Rodillo Cemento',             'T',   'repuesto',      'Cemento'),
  ('EMP_CEM',     'Empaque Cemento',                                'T',   'repuesto',      'Empaque'),

  -- A.6 Servicios y operaciones
  ('DESC_FINOS',  'Descargue Finos (Mini)',                         'T',   'servicio',      'Operación'),
  ('DESC_ALT',    'Descargue de Alternos',                          'T',   'servicio',      'Operación'),
  ('CARG_ALT',    'Cargue de Alternos',                             'T',   'servicio',      'Operación'),
  ('CARGADOR_CA', 'Cargador Carbón',                                'T',   'servicio',      'Operación'),
  ('DESATASQUE',  'Desatasque de Carbón',                           'Mes', 'servicio',      'Operación'),
  ('DESC_MP',     'Descargue MP',                                   'T',   'servicio',      'Operación'),
  ('CARG_CK_TLV', 'Cargue Clinker (En Tolva)',                      'T',   'servicio',      'Operación'),
  ('CARG_CK_VTA', 'Cargue Clinker Venta',                           'T',   'servicio',      'Operación'),
  ('DOSIF_SAL',   'Dosificación Sal',                               'T',   'servicio',      'Operación'),
  ('EMP_GRANEL',  'Empaque y Granel',                               'T',   'servicio',      'Operación'),
  ('EMP_UNIT',    'Unitario Empaque y Granel',                      'Saco','servicio',      'Operación'),
  ('EMP_FIJO_HE', 'Fijo + Horas Extras Empaque',                   'Mes', 'servicio',      'Operación'),

  -- A.7 Aditivos y empaques
  ('ADITIVO_CEM', 'Aditivo Cemento',                                'Kgr', 'aditivo',       'Aditivo'),
  ('SACO_50_TPX', 'Saco 50 Kg Topex',                               'UN',  'empaque',       'Saco'),
  ('SACO_42_ART', 'Saco 42,5 Kg ART',                               'UN',  'empaque',       'Saco'),

  -- A.8 Regalías específicas
  ('REG_ARCILLA', 'Regalías Arcilla',                               'T',   'regalia',       'Mina'),
  ('REG_CALIZA',  'Regalías Caliza',                                'T',   'regalia',       'Mina'),

  -- Productos granel para ORD 17, 18, 22
  ('CEM_UG_GRL',  'Cemento UG Granel',                              'T',   'producto',      'Cemento UG'),
  ('CEM_ART_GRL', 'Cemento ART Granel',                             'T',   'producto',      'Cemento ART'),
  ('FIBRO_GRL',   'Fibrocemento Granel',                            'T',   'producto',      'Fibrocemento')

on conflict (codigo) do nothing;

-- Verificar conteo mínimo
do $$
declare
  n int;
begin
  select count(*) into n from materiales;
  raise notice 'Total materiales después de migración 018: %', n;
  if n < 125 then
    raise exception 'Esperado >= 125 materiales, encontrados %', n;
  end if;
end $$;
