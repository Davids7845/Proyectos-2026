/**
 * db-status.ts — Verifica el estado de la base de datos Supabase.
 * Uso: npm run db:status
 *
 * Lee .env.local (o variables de entorno del shell) y reporta:
 *   - Presencia de cada tabla requerida
 *   - Conteo de filas por tabla
 *   - Datos semilla (17 procesos ORD)
 *   - Timezone de la BD
 *
 * Salida: código 0 si todo está correcto, código 1 si hay problemas.
 */

// Variables de entorno: cargadas por tsx --env-file .env.local (Node 20+)
// o directamente desde el entorno del shell (ej: Vercel, CI).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: Faltan variables de entorno.");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "OK" : "FALTA");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", SERVICE_KEY ? "OK" : "FALTA");
  console.error("\nCopia .env.example a .env.local y completa los valores.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const REQUIRED_TABLES = [
  "budget_versions",
  "procesos",
  "clases_costo",
  "materiales",
  "maestro_sap",
  "material_aliases",
  "formula_definitions",
  "formula_dependencies",
  "precios_insumos",
  "porcentajes_consumo",
  "recetas",
  "receta_lineas",
  "humedades",
  "rendimientos",
  "ventas_proyectadas",
  "parametros_energia",
  "roturas_sacos",
  "inventarios_finales",
  "calculation_runs",
  "calculation_log",
  "calculation_log_deps",
  "costo_proceso",
  "movimientos_contables",
  // Migración 007
  "costos_fijos_proceso",
  "energia_overrides",
  "mp_overrides",
] as const;

const SEED_ORDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 19, 20, 21];

function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function fail(msg: string) { console.log(`  ✗  ${msg}`); }
function info(msg: string) { console.log(`     ${msg}`); }

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Cementos Capital — Estado de la BD");
  console.log(`  ${SUPABASE_URL}`);
  console.log("═══════════════════════════════════════════\n");

  let totalFails = 0;

  // ─── Tablas ───────────────────────────────────────────────────────────────
  console.log("[ Tablas ]\n");

  const tableResults: Array<{ table: string; count: number | null; exists: boolean }> = [];

  for (const table of REQUIRED_TABLES) {
    const { count, error } = await (supabase as any)
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      // Tabla no existe o sin permisos
      fail(`${table.padEnd(30)} NO EXISTE  ${error.message}`);
      tableResults.push({ table, count: null, exists: false });
      totalFails++;
    } else {
      ok(`${table.padEnd(30)} ${String(count ?? 0).padStart(6)} filas`);
      tableResults.push({ table, count: count ?? 0, exists: true });
    }
  }

  // ─── Procesos seed ────────────────────────────────────────────────────────
  console.log("\n[ Procesos seed ]\n");

  const { data: procesos, error: procError } = await supabase
    .from("procesos")
    .select("ord, nombre")
    .order("ord");

  if (procError) {
    fail(`No se pudo leer procesos: ${procError.message}`);
    totalFails++;
  } else {
    const existingOrds = new Set((procesos ?? []).map(p => p.ord));
    const missingOrds = SEED_ORDS.filter(ord => !existingOrds.has(ord));

    if (missingOrds.length === 0) {
      ok(`${SEED_ORDS.length} procesos ORD presentes`);
      for (const p of procesos ?? []) {
        info(`ORD ${String(p.ord).padStart(2)}  ${p.nombre}`);
      }
    } else {
      fail(`Faltan ${missingOrds.length} procesos: ORD ${missingOrds.join(", ")}`);
      info("Ejecuta supabase/migrations/002_seed_masters.sql en el SQL Editor");
      totalFails++;
    }
  }

  // ─── Materiales seed ──────────────────────────────────────────────────────
  console.log("\n[ Materiales seed ]\n");
  const { count: matCount } = await supabase
    .from("materiales")
    .select("*", { count: "exact", head: true });

  if ((matCount ?? 0) < 20) {
    fail(`Solo ${matCount} materiales — seed incompleto (se esperan ≥ 20)`);
    totalFails++;
  } else {
    ok(`${matCount} materiales presentes`);
  }

  // ─── Timezone ─────────────────────────────────────────────────────────────
  console.log("\n[ Timezone ]\n");
  const { data: tzData, error: tzError } = await supabase.rpc("current_setting", {
    setting_name: "TIMEZONE",
  }).single() as any;

  if (tzError) {
    // Intentar con query raw a través de un RPC si no existe
    info("No se pudo verificar timezone via RPC (normal si no existe la función)");
    info("Ejecutar manualmente en SQL Editor: SHOW timezone;");
    info("Debe devolver: America/Bogota");
  } else {
    const tz = String(tzData ?? "");
    if (tz.toLowerCase().includes("bogota") || tz.toLowerCase().includes("america/bogota")) {
      ok(`Timezone: ${tz}`);
    } else {
      fail(`Timezone incorrecto: "${tz}" (esperado: America/Bogota)`);
      info("Ejecutar en SQL Editor: alter database postgres set timezone to 'America/Bogota';");
      totalFails++;
    }
  }

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════\n");
  if (totalFails === 0) {
    console.log("  RESULTADO: OK — BD lista para usar\n");
    process.exit(0);
  } else {
    console.log(`  RESULTADO: ${totalFails} problema(s) encontrado(s)\n`);
    console.log("  Ver DEPLOYMENT.md para instrucciones de configuración.\n");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
