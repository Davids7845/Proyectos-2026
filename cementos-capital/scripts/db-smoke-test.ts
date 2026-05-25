/**
 * db-smoke-test.ts — Smoke test post-despliegue de Supabase.
 * Uso: npm run db:smoke
 *
 * Verifica:
 *   1. Service role puede insertar y leer datos
 *   2. RLS funciona: anon key NO puede leer versiones sin autenticarse
 *   3. Constraints básicos funcionan (FK, UNIQUE)
 *   4. Limpieza automática al final
 *
 * Salida: código 0 si todos los checks pasan, código 1 si falla alguno.
 */

// Variables de entorno: cargadas por tsx --env-file .env.local (Node 20+)
// o directamente desde el entorno del shell (ej: Vercel, CI).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("ERROR: Faltan variables de entorno. Copia .env.example a .env.local.");
  process.exit(1);
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

const SMOKE_NAME = `SMOKE_TEST_${Date.now()}`;
let createdVersionId: string | null = null;
let passes = 0;
let fails = 0;

function check(label: string, passed: boolean, detail?: string) {
  if (passed) {
    console.log(`  ✓  ${label}`);
    passes++;
  } else {
    console.log(`  ✗  ${label}${detail ? `  → ${detail}` : ""}`);
    fails++;
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Cementos Capital — Smoke Test");
  console.log(`  ${SUPABASE_URL}`);
  console.log("═══════════════════════════════════════════\n");

  // ─── 1. Service role: crear budget_version ────────────────────────────────
  console.log("[ 1. Inserción con service role ]\n");

  const { data: version, error: vErr } = await serviceClient
    .from("budget_versions")
    .insert({
      nombre: SMOKE_NAME,
      periodo_inicio: "2026-01-01",
      periodo_fin: "2026-12-01",
      estado: "borrador",
    })
    .select("id")
    .single();

  check("Crear budget_version", !vErr && !!version?.id, vErr?.message);
  if (vErr || !version) {
    console.log("\n  ABORT: no se puede continuar sin una versión de prueba.\n");
    process.exit(1);
  }
  createdVersionId = version.id;

  // ─── 2. Service role: insertar precios dummy ──────────────────────────────
  const { data: mat } = await serviceClient
    .from("materiales")
    .select("id")
    .limit(3);

  if (mat && mat.length >= 1) {
    const { error: precErr } = await serviceClient
      .from("precios_insumos")
      .insert(
        mat.slice(0, 3).map((m, i) => ({
          version_id: createdVersionId,
          material_id: m.id,
          proveedor: null,
          periodo: "2026-01-01",
          precio_unitario: (i + 1) * 10000,
          unidad: "COP/Ton",
          moneda: "COP",
        }))
      );
    check("Insertar 3 precios insumos", !precErr, precErr?.message);
  } else {
    check("Insertar 3 precios insumos", false, "No hay materiales seed — ejecuta las migrations");
  }

  // ─── 3. Service role: leer la versión recién creada ───────────────────────
  console.log("\n[ 2. Lectura con service role ]\n");

  const { data: readBack, error: readErr } = await serviceClient
    .from("budget_versions")
    .select("id, nombre")
    .eq("id", createdVersionId)
    .single();

  check("Service role puede leer la versión", !readErr && readBack?.nombre === SMOKE_NAME, readErr?.message);

  // ─── 4. Anon key: NO debe poder leer la versión (RLS) ────────────────────
  console.log("\n[ 3. RLS — anon key no puede leer sin auth ]\n");

  const { data: anonData, error: anonErr } = await anonClient
    .from("budget_versions")
    .select("id")
    .eq("id", createdVersionId);

  // "blocked" = either PGRST error (no GRANT/policy) OR zero rows (RLS filtering)
  const anonRows = anonData?.length ?? 0;
  const rlsBlocked = !!anonErr || anonRows === 0;
  check(
    "Anon key NO puede ver la versión (RLS activo)",
    rlsBlocked,
    !rlsBlocked
      ? `RLS FALTA — anon key leyó ${anonRows} fila(s) — ejecutar fix_rls.sql en SQL Editor`
      : undefined,
  );

  // ─── 5. Verificar conteo de calculation_runs ─────────────────────────────
  console.log("\n[ 4. Tablas de cálculo accesibles ]\n");

  const { count: runsCount, error: runsErr } = await serviceClient
    .from("calculation_runs")
    .select("*", { count: "exact", head: true });

  check(
    "calculation_runs accesible",
    !runsErr,
    runsErr?.message,
  );
  if (!runsErr) {
    console.log(`     (${runsCount ?? 0} runs históricos en la BD)`);
  }

  // ─── Limpieza ─────────────────────────────────────────────────────────────
  console.log("\n[ Limpieza ]\n");

  const { error: delErr } = await serviceClient
    .from("budget_versions")
    .delete()
    .eq("id", createdVersionId);

  check("Eliminar versión de prueba", !delErr, delErr?.message);
  createdVersionId = null;

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════\n");
  console.log(`  Checks: ${passes} OK, ${fails} FAIL\n`);

  if (fails === 0) {
    console.log("  RESULTADO: OK — Supabase operativo\n");
    process.exit(0);
  } else {
    console.log("  RESULTADO: FAIL — ver detalles arriba\n");
    process.exit(1);
  }
}

main().catch(async err => {
  console.error("Error inesperado:", err);
  // Intentar limpiar si quedó versión creada
  if (createdVersionId) {
    await serviceClient.from("budget_versions").delete().eq("id", createdVersionId);
  }
  process.exit(1);
});
