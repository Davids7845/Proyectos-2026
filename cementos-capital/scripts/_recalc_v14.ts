// Script: recalcular versión v14 y verificar plan_movimientos ORD1
// Uso: tsx scripts/_recalc_v14.ts
//
// Requiere que migration 028 (plan_movimientos) ya esté aplicada en producción.

import { createClient } from "@supabase/supabase-js";
import { runCalculation } from "@/lib/calc/engine/runner";

const SUPABASE_URL = "https://vcickuamnwrecprfzvah.supabase.co";
const ANON_KEY    = "sb_publishable_tmCZ8gRqjBfzJYXE3Rj0VA_D9rnUvdY";
const EMAIL       = "e2e-test@cementoscapital.com";
const PASSWORD    = "Cadaser2013";

const VERSION_ID  = "6d29b28b-8328-43e6-bac3-9b2c5787c236";
const ORD1_ID     = "abb5f568-78c6-4d43-af4c-abc78cc1439a";

async function main() {
  // 1) Autenticar
  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr || !auth?.session) throw new Error(`Auth failed: ${authErr?.message}`);
  console.log("✓ Autenticado como", auth.user.email);

  // 2) Recalcular v14
  console.log("\nIniciando recálculo de v14...");
  const summary = await runCalculation(sb, { versionId: VERSION_ID, iniciado_por: auth.user.id });
  console.log("Resultado:", {
    runId: summary.runId,
    estado: summary.estado,
    duracion_ms: summary.duracion_ms,
    total_calculos: summary.total_calculos,
    procesos_calculados: summary.procesos_calculados,
    omitidos: summary.procesos_omitidos.length,
  });
  if (summary.error_msg) console.error("Error:", summary.error_msg);
  if (summary.procesos_omitidos.length > 0) {
    console.warn("Omitidos:", summary.procesos_omitidos.map(o => `ORD${o.ord}: ${o.razon}`).join("\n  "));
  }
  if (summary.estado !== "exitoso") throw new Error("Recálculo no exitoso");

  // 3) Verificar plan_movimientos ORD1 2026
  console.log("\nVerificando plan_movimientos ORD1 2026...");
  const { data: movs, error: movErr } = await (sb as any)
    .from("plan_movimientos")
    .select("periodo, tipo, codigo, produccion_ton, cantidad, costo_unitario, valor")
    .eq("version_id", VERSION_ID)
    .eq("proceso_id", ORD1_ID)
    .gte("periodo", "2026-01-01")
    .lte("periodo", "2026-12-01")
    .order("periodo")
    .order("tipo")
    .order("codigo");
  if (movErr) throw new Error(`plan_movimientos query: ${movErr.message}`);

  // Calcular promedio ponderado anual por periodo
  const byPeriodo: Record<string, { total_valor: number; produccion: number }> = {};
  for (const m of movs ?? []) {
    const p = m.periodo;
    if (!byPeriodo[p]) byPeriodo[p] = { total_valor: 0, produccion: 0 };
    byPeriodo[p].total_valor += Number(m.valor);
    // produccion_ton es la misma para todos los componentes del mismo periodo
    byPeriodo[p].produccion = Math.max(byPeriodo[p].produccion, Number(m.produccion_ton));
  }

  const periodos = Object.keys(byPeriodo).sort();
  console.log(`\nMeses 2026: ${periodos.length}`);
  let suma_valor = 0;
  let suma_prod  = 0;
  for (const p of periodos) {
    const { total_valor, produccion } = byPeriodo[p];
    suma_valor += total_valor;
    suma_prod  += produccion;
    console.log(`  ${p}: costo_mes=${total_valor.toFixed(2)}, prod=${produccion}`);
  }

  const costo_ponderado = suma_valor / suma_prod;
  console.log(`\nSUM(valor) = ${suma_valor.toFixed(2)}`);
  console.log(`SUM(prod)  = ${suma_prod}`);
  console.log(`\n✓ Costo ponderado anual ORD1 2026 = ${costo_ponderado.toFixed(2)}`);

  const target = 15372.59;
  const diff_pct = Math.abs(costo_ponderado - target) / target * 100;
  if (diff_pct <= 0.5) {
    console.log(`✅ VERIFICADO: ${costo_ponderado.toFixed(2)} ≈ ${target} (diff ${diff_pct.toFixed(3)}%)`);
  } else {
    console.error(`❌ FALLO: esperado ${target}, obtenido ${costo_ponderado.toFixed(2)} (diff ${diff_pct.toFixed(2)}%)`);
    process.exit(1);
  }

  // 4) Desglose por componente
  console.log("\nDesglose anual por componente (suma 12 meses):");
  const byCodigo: Record<string, { nombre: string; suma_valor: number; suma_cant: number }> = {};
  for (const m of movs ?? []) {
    const c = m.codigo;
    if (!byCodigo[c]) byCodigo[c] = { nombre: m.codigo, suma_valor: 0, suma_cant: 0 };
    byCodigo[c].suma_valor += Number(m.valor);
    byCodigo[c].suma_cant  += Number(m.cantidad);
  }
  for (const [codigo, d] of Object.entries(byCodigo)) {
    const cu = d.suma_cant > 0 ? d.suma_valor / d.suma_cant : 0;
    const aporte = d.suma_valor / suma_prod;
    console.log(`  ${codigo}: aporte=${aporte.toFixed(2)} COP/Ton, cu=${cu.toFixed(2)}, cant_12m=${d.suma_cant.toFixed(4)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
