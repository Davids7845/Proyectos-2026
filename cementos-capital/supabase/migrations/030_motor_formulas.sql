-- 030: Motor de Fórmulas — tablas definitivas de producción.
-- Promueve el esquema POC (poc_*) a tablas finales sin prefijo.
-- Representa la cadena del Excel: Datos → Base → TD → Costo.
--
-- Estas tablas coexisten con las viejas (costo_proceso, calculation_log).
-- La UI sigue leyendo las viejas hasta R6.

-- ── INPUTS (hoja Datos del Excel) ───────────────────────────────────────────

-- Recetas: composición de cada proceso × período
create table if not exists receta_componentes (
  id            uuid primary key default uuid_generate_v4(),
  version_id    uuid references budget_versions(id) on delete cascade,
  ord           int not null,
  orden_visual  int default 0,
  material_codigo text,
  tipo          text not null,
  unidad_calculo text not null check (
    unidad_calculo in ('receta_humedad','por_ton','energia','cascada','placeholder','sacos')
  ),
  es_cascada    boolean default false,
  ord_origen    int,
  periodo       int not null,
  receta_pct    numeric(16,8),
  precio        numeric(18,4),
  flete         numeric(18,4) default 0,
  humedad       numeric(10,8) default 0,
  creado_en     timestamptz default now()
);
create index if not exists idx_receta_v_ord_per on receta_componentes(version_id, ord, periodo);

-- Producción por proceso/período
create table if not exists produccion_proceso (
  id         uuid primary key default uuid_generate_v4(),
  version_id uuid references budget_versions(id) on delete cascade,
  ord        int not null,
  periodo    int not null,
  toneladas  numeric(18,4),
  unique(version_id, ord, periodo)
);

-- ── MOVIMIENTOS generados (hoja Base) ───────────────────────────────────────
create table if not exists movimientos_generados (
  id              uuid primary key default uuid_generate_v4(),
  version_id      uuid references budget_versions(id) on delete cascade,
  ord             int not null,
  periodo         int not null,
  material_codigo text,
  tipo            text,
  cantidad        numeric(20,6),
  valor           numeric(22,4),
  es_cascada      boolean default false,
  ord_origen      int,
  consumo_unitario numeric(20,8),
  creado_en       timestamptz default now()
);
create index if not exists idx_movgen_v_ord_per on movimientos_generados(version_id, ord, periodo);

-- ── COSTO calculado (hoja Costo) ────────────────────────────────────────────
create table if not exists costo_calculado (
  id               uuid primary key default uuid_generate_v4(),
  version_id       uuid references budget_versions(id) on delete cascade,
  ord              int not null,
  periodo          int not null,
  tipo             text,
  orden_visual     int default 0,
  consumo_unitario numeric(20,8),
  costo_unitario   numeric(18,4),
  aporte_por_ton   numeric(18,4),
  es_total         boolean default false,
  es_cascada       boolean default false,
  creado_en        timestamptz default now()
);
create index if not exists idx_costocalc_v_ord_per on costo_calculado(version_id, ord, periodo);

-- ── RLS + grants (mismo patrón que el resto del esquema) ─────────────────────
alter table receta_componentes    enable row level security;
alter table produccion_proceso    enable row level security;
alter table movimientos_generados enable row level security;
alter table costo_calculado        enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='receta_componentes' and policyname='auth full receta_componentes') then
    create policy "auth full receta_componentes" on receta_componentes for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='produccion_proceso' and policyname='auth full produccion_proceso') then
    create policy "auth full produccion_proceso" on produccion_proceso for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='movimientos_generados' and policyname='auth full movimientos_generados') then
    create policy "auth full movimientos_generados" on movimientos_generados for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='costo_calculado' and policyname='auth full costo_calculado') then
    create policy "auth full costo_calculado" on costo_calculado for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
  end if;
end $$;

grant all on receta_componentes, produccion_proceso, movimientos_generados, costo_calculado to authenticated;
