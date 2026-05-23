-- ORD 20 (Combustibles Alternos) produce un semielaborado de costo blended
-- que ORD 5 (Clinkerización) puede arrastrar como componente.

insert into materiales (codigo, nombre, unidad_base, categoria, tipo_insumo)
values ('COMBALT', 'Combustibles Alternos (blended)', 'T', 'semielaborado', 'Alternos')
on conflict (codigo) do nothing;
