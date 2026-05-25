// Diagnóstico ORD 4 — Molienda Carbón
// Imprime la receta resuelta, precios obtenidos por componente y blend ponderado.
// Uso: npx tsx scripts/diagnose_ord4.ts

import { loadExcelFixture, extractPresupuesto } from "../tests/fixtures/load_excel_fixture";
import { buildContextFromExcel } from "../tests/fixtures/build_context_from_excel";
import { parseExcel } from "../lib/import/excel-importer";

const PERIODO = "2026-01-01";
const TARGET_BLEND = 251_126.22; // Carbón Molido MP esperado del Excel
const TARGET_TOTAL = 302_320.56; // Total ORD 4 (con energía + descargues)

console.log("─".repeat(70));
console.log(" DIAGNÓSTICO ORD 4 — Molienda Carbón");
console.log(`  Periodo: ${PERIODO}`);
console.log(`  Target blend MP : ${TARGET_BLEND.toLocaleString("es-CO")} COP/Ton`);
console.log(`  Target total    : ${TARGET_TOTAL.toLocaleString("es-CO")} COP/Ton`);
console.log("─".repeat(70));

const buf = loadExcelFixture();

// 1) Crudo del importer (sin alias) — para inspeccionar los datos del Excel
const parsed = parseExcel(buf);
console.log("\n[1] FILAS DE RECETA en Excel para producto = 'Carbón' o variantes:");
const recetasCarbon = parsed.recetas.filter(
  r => /carb/i.test(r.producto_nombre) && r.periodo === PERIODO
);
for (const r of recetasCarbon) {
  console.log(
    `    producto="${r.producto_nombre}" material="${r.material_nombre}" `
    + `pct=${(r.porcentaje * 100).toFixed(2)}%`
  );
}

console.log("\n[2] FILAS DE % CONSUMO en Excel relacionadas con carbón:");
const pctCarbon = parsed.porcentajes_consumo.filter(
  pc => pc.periodo === PERIODO &&
  (/carb|sanoh|forero|bitum|mixto|payand/i.test(pc.material_nombre))
);
for (const pc of pctCarbon) {
  console.log(`    material="${pc.material_nombre}" pct=${(pc.porcentaje * 100).toFixed(2)}%`);
}

console.log("\n[3] FILAS DE PRECIO en Excel relacionadas con carbón:");
const precCarbon = parsed.precios.filter(
  p => p.periodo === PERIODO &&
  (/carb|sanoh|forero|bitum|mixto|payand|tap/i.test(p.material_nombre))
);
for (const p of precCarbon) {
  console.log(`    material="${p.material_nombre}" precio=${p.precio.toLocaleString("es-CO")} unidad=${p.unidad}`);
}

// 2) Contexto construido (con aliases aplicados)
console.log("\n" + "─".repeat(70));
console.log(" CONTEXTO BUILD (post-alias)");
console.log("─".repeat(70));

const built = buildContextFromExcel(buf, { periodos: [PERIODO] });
const ctx = built.ctx;

// Encontrar el proceso ORD 4
const ord4 = ctx.procesos.find(p => p.ord === 4);
if (!ord4) {
  console.error("ERROR: ORD 4 no encontrado en context.procesos");
  process.exit(1);
}
console.log(`\n[4] PROCESO ORD 4: id=${ord4.id} material="${ord4.material}" nombre="${ord4.nombre}"`);

// Buscar la receta
const recetaKey = `${ord4.id}|${PERIODO}`;
const receta = ctx.recetasByProcesoPeriodo.get(recetaKey);
if (!receta) {
  console.log(`\n[5] ⚠ NO HAY RECETA en ctx para ORD 4 @ ${PERIODO}`);
  console.log("    Claves de recetas disponibles:");
  for (const k of Array.from(ctx.recetasByProcesoPeriodo.keys())) {
    if (k.startsWith(ord4.id)) console.log("      ", k);
  }
} else {
  console.log(`\n[5] RECETA RESUELTA (${receta.lineas.length} líneas):`);
  let blend = 0;
  let totalPct = 0;
  for (const ln of receta.lineas) {
    const mat = ctx.materialesById.get(ln.material_id);
    const k = `${ln.material_id}|${PERIODO}|`;
    const p = ctx.preciosByMatPeriodo.get(k);
    const precio = p?.precio ?? null;
    const contrib = precio != null ? precio * ln.porcentaje : 0;
    blend += contrib;
    totalPct += ln.porcentaje;
    console.log(
      `    [${mat?.codigo.padEnd(12) ?? "?".padEnd(12)}] `
      + `nombre="${(mat?.nombre ?? "?").padEnd(30)}" `
      + `pct=${(ln.porcentaje * 100).toFixed(2).padStart(6)}% `
      + `precio=${precio != null ? precio.toLocaleString("es-CO").padStart(12) : "  ¿NULL?  "} `
      + `contrib=${contrib.toLocaleString("es-CO").padStart(12)}`
    );
  }
  console.log(`\n    Σ pct=${(totalPct * 100).toFixed(2)}%`);
  console.log(`    BLEND CALCULADO : ${blend.toLocaleString("es-CO", { maximumFractionDigits: 2 })} COP/Ton`);
  console.log(`    TARGET BLEND    : ${TARGET_BLEND.toLocaleString("es-CO")} COP/Ton`);
  console.log(`    Diff           : ${((blend - TARGET_BLEND) / TARGET_BLEND * 100).toFixed(2)}%`);
}

// 3) Buscar precios para todos los códigos de carbón conocidos
console.log("\n" + "─".repeat(70));
console.log(" PRECIOS RESUELTOS POR CÓDIGO (todos los carbones)");
console.log("─".repeat(70));
const codCarbon = ["CARBITUMI", "CARB_MIXTO", "CARB_FINO", "CARBONMOL"];
for (const cod of codCarbon) {
  const mat = ctx.materialesByCodigo.get(cod);
  if (!mat) { console.log(`    ${cod.padEnd(12)}: ⚠ no en materialesByCodigo`); continue; }
  const k = `${mat.id}|${PERIODO}|`;
  const p = ctx.preciosByMatPeriodo.get(k);
  console.log(`    ${cod.padEnd(12)} (${mat.nombre.padEnd(30)}) → ${p != null ? p.precio.toLocaleString("es-CO") : "⚠ sin precio"}`);
}

// 4) Verificar target presupuesto
const ppto = extractPresupuesto(buf);
const target = ppto.find(p => p.proceso === "Molienda Carbón");
console.log("\n" + "─".repeat(70));
console.log(` Target Excel (col P fila 45): ${target?.valor.toLocaleString("es-CO")} COP/Ton`);
console.log("─".repeat(70));
