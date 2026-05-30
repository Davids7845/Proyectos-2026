// Genera el SQL de seed del período 1 a partir de SEED_PERIODO1 (la misma
// fuente que valida el motor 17/17 standalone). Emite INSERTs para
// produccion_proceso + receta_componentes envueltos en un DO block que
// resuelve la versión automáticamente (la más reciente) o por id editable.
//
// Uso:  npx tsx scripts/generar_seed_sql.ts > supabase/migrations/031_seed_motor_periodo1.sql

import { SEED_PERIODO1 } from "../lib/calc/motor/seed_periodo1";

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlNum(n: number | null | undefined): string {
  return n == null ? "null" : String(n);
}
function sqlBool(b: boolean): string {
  return b ? "true" : "false";
}

const lines: string[] = [];
lines.push("-- 031: Seed del motor de fórmulas — Período 1 (R6b paso 1).");
lines.push("-- GENERADO automáticamente desde lib/calc/motor/seed_periodo1.ts");
lines.push("-- (no editar a mano: regenerar con scripts/generar_seed_sql.ts).");
lines.push("--");
lines.push("-- Puebla produccion_proceso + receta_componentes para que el endpoint");
lines.push("-- /recalcular-motor pueda calcular y llenar costo_calculado.");
lines.push("-- Idempotente: borra el período 1 de esta versión antes de insertar.");
lines.push("");
lines.push("do $$");
lines.push("declare");
lines.push("  v_version uuid;");
lines.push("begin");
lines.push("  -- Por defecto toma la versión más reciente. Para fijar una versión");
lines.push("  -- concreta, reemplaza la línea siguiente por:  v_version := 'TU-UUID';");
lines.push("  select id into v_version from budget_versions order by creado_en desc limit 1;");
lines.push("  if v_version is null then");
lines.push("    raise exception 'No hay budget_versions en la base';");
lines.push("  end if;");
lines.push("");
lines.push("  delete from receta_componentes where version_id = v_version and periodo = 1;");
lines.push("  delete from produccion_proceso where version_id = v_version and periodo = 1;");
lines.push("");

// ── produccion_proceso ──
lines.push("  insert into produccion_proceso (version_id, ord, periodo, toneladas) values");
const prodRows = SEED_PERIODO1.map(
  p => `    (v_version, ${p.ord}, 1, ${p.produccion})`
);
lines.push(prodRows.join(",\n") + ";");
lines.push("");

// ── receta_componentes ──
lines.push("  insert into receta_componentes");
lines.push("    (version_id, ord, periodo, orden_visual, material_codigo, tipo,");
lines.push("     unidad_calculo, es_cascada, ord_origen, receta_pct, precio, flete, humedad) values");
const recetaRows: string[] = [];
for (const p of SEED_PERIODO1) {
  p.recetas.forEach((r, i) => {
    recetaRows.push(
      `    (v_version, ${p.ord}, 1, ${i}, ${sqlStr(r.material_codigo)}, ${sqlStr(r.tipo)}, ` +
      `${sqlStr(r.unidad_calculo)}, ${sqlBool(r.es_cascada)}, ${sqlNum(r.ord_origen)}, ` +
      `${sqlNum(r.receta_pct)}, ${sqlNum(r.precio)}, ${sqlNum(r.flete)}, ${sqlNum(r.humedad)})`
    );
  });
}
lines.push(recetaRows.join(",\n") + ";");
lines.push("");
lines.push("  raise notice 'Seed motor período 1 cargado para versión %', v_version;");
lines.push("end $$;");
lines.push("");

process.stdout.write(lines.join("\n"));
