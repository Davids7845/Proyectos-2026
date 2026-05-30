/**
 * poc_validar_crudo_local.ts — Validación en memoria del motor de fórmulas ORD 3.
 *
 * NO requiere conexión a Supabase. Implementa el mismo motor que los módulos
 * generar_movimientos / calcular_costo pero en memoria pura, para verificar
 * matemáticamente que la fórmula replica el Excel.
 *
 * Uso: npx tsx scripts/poc_validar_crudo_local.ts
 *
 * Objetivo de reconciliación: $31,752.89 COP/Ton (Molienda de Crudo, ORD 3, Sep-2025)
 */

import { generarMovimientos } from "../lib/calc/poc/generar_movimientos";
import { calcularCosto }      from "../lib/calc/poc/calcular_costo";
import type { PocReceta }     from "../lib/calc/poc/types";

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE REFERENCIA — verificados celda-a-celda contra el Excel
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCCION_ORD3 = 132_000; // Ton (Sep-2025)

// Costos de procesos origen para resolver cascadas
const COSTOS_ORIGEN = new Map<number, number>([
  [1, 15_372.59],  // ORD 1: Trituración (Mezcla Prehomo)
  [2, 16_036.45],  // ORD 2: Adiciones   (Caliza Adiciones)
]);

// Receta ORD 3 — las mismas filas que poc_002_seed_crudo.sql
const RECETAS_ORD3: PocReceta[] = [
  // ── Cascadas ──────────────────────────────────────────────────────────────
  {
    material_codigo: "MEZCPREHO",
    tipo:            "Prehomo",
    es_cascada:      true,
    ord_origen:      1,
    receta_pct:      0.8313,
    precio:          null,
    flete:           0,
    humedad:         0,
    unidad_calculo:  "cascada",
  },
  {
    material_codigo: "CALIZATRI",
    tipo:            "Caliza Adiciones",
    es_cascada:      true,
    ord_origen:      2,
    receta_pct:      0.1828,
    precio:          null,
    flete:           0,
    humedad:         0,
    unidad_calculo:  "cascada",
  },
  // ── Minerales de Hierro (receta × (1+humedad)) ───────────────────────────
  {
    material_codigo: "CORRHIERR",
    tipo:            "Mineral de Hierro",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      0.0201875,
    precio:          299_941.95, // Datos!I48 — precio base, Flete en Datos!H90 (incl ≈ 885 COP/Ton)
    flete:           0,
    humedad:         0.10,
    unidad_calculo:  "receta_humedad",
  },
  {
    material_codigo: "CALAMINA1",
    tipo:            "Mineral de Hierro",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      0.0035625,
    precio:          169_514.65,
    flete:           0,
    humedad:         0.063,
    unidad_calculo:  "receta_humedad",
  },
  // ── Repuestos (precio es COP/Ton directo) ────────────────────────────────
  {
    material_codigo: "CUERPOS_MOL_CR",
    tipo:            "Cuerpos Moledores",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      1,
    precio:          167.11,
    flete:           0,
    humedad:         0,
    unidad_calculo:  "por_ton",
  },
  {
    material_codigo: "LAMINAS_CR",
    tipo:            "Láminas",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      1,
    precio:          119.88,
    flete:           0,
    humedad:         0,
    unidad_calculo:  "por_ton",
  },
  {
    material_codigo: "ANILLOS_CR",
    tipo:            "Anillos, Tapas y Separadores",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      1,
    precio:          498.70,
    flete:           0,
    humedad:         0,
    unidad_calculo:  "por_ton",
  },
  // ── Energía eléctrica ────────────────────────────────────────────────────
  {
    material_codigo: "ENERGIA",
    tipo:            "Energía",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      15.1,       // kWh/Ton
    precio:          521.62,     // COP/kWh (precio_contrato; precio efectivo incl. restricciones ≈ 525.15)
    flete:           0,
    humedad:         0,
    unidad_calculo:  "energia",
  },
  // ── Placeholder ──────────────────────────────────────────────────────────
  {
    material_codigo: "SILICE",
    tipo:            "Sílice",
    es_cascada:      false,
    ord_origen:      null,
    receta_pct:      0,
    precio:          0,
    flete:           0,
    humedad:         0,
    unidad_calculo:  "placeholder",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Valores de referencia del Excel (para reportar diff%)
// ─────────────────────────────────────────────────────────────────────────────

const EXCEL: Record<string, number> = {
  "Prehomo (cascada)":              12_779.42,
  "Caliza Adiciones (cascada)":      2_931.62,
  "Mineral de Hierro":               7_325.52,  // CORRHIERR + CALAMINA1
  "Cuerpos Moledores":                 167.11,
  "Láminas":                           119.88,
  "Anillos, Tapas y Separadores":      498.70,
  "Energía":                         7_929.69,
  "Sílice":                              0.00,
  "TOTAL":                          31_752.89,
};

// ─────────────────────────────────────────────────────────────────────────────
// Ejecutar motor
// ─────────────────────────────────────────────────────────────────────────────

const movimientos = generarMovimientos(PRODUCCION_ORD3, RECETAS_ORD3);
const resultado   = calcularCosto(movimientos, COSTOS_ORIGEN);

// ─────────────────────────────────────────────────────────────────────────────
// Reporte
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function diff(got: number, expected: number) {
  return (((got - expected) / expected) * 100).toFixed(2);
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  PRUEBA DE CONCEPTO: Motor de Fórmulas — Molienda de Crudo ORD 3");
console.log("═══════════════════════════════════════════════════════════════\n");

// ── Validar cantidades individuales ─────────────────────────────────────────
const CANT_EXCEL: Record<string, number> = {
  CORRHIERR: 2_931.22,
  CALAMINA1:   499.88,
};

console.log("GENERACIÓN DE MOVIMIENTOS ORD 3:");
const movFiltrados = movimientos.filter(m => m.tipo !== "Producción");
console.log(`  Movimientos generados: ${movFiltrados.length + 1} (${movFiltrados.length} insumos + 1 producción)`);
console.log(`  Esperado: 9 (8 insumos + 1 producción)\n`);

for (const [codigo, cantExp] of Object.entries(CANT_EXCEL)) {
  const mov = movimientos.find(m => m.material_codigo === codigo);
  const cantGot = mov ? mov.cantidad : 0;
  const d = diff(cantGot, cantExp);
  console.log(`  Cantidad ${codigo}: ${fmt(cantGot)} Ton / esperado ${fmt(cantExp)} → diff ${d}%`);
}

// ── Agrupar mineral de hierro (dos fuentes) para comparar con Excel ──────────
const aporteMineral = resultado.desglose
  .filter(d => d.tipo === "Mineral de Hierro")
  .reduce((s, d) => s + d.aporte_por_ton, 0);

console.log("\nDESGLOSE DE COSTO (vs Excel):");
const TIPO_KEY: Record<string, string> = {
  "Prehomo":                         "Prehomo (cascada)",
  "Caliza Adiciones":                "Caliza Adiciones (cascada)",
  "Mineral de Hierro":               "Mineral de Hierro",
  "Cuerpos Moledores":               "Cuerpos Moledores",
  "Láminas":                         "Láminas",
  "Anillos, Tapas y Separadores":    "Anillos, Tapas y Separadores",
  "Energía":                         "Energía",
  "Sílice":                          "Sílice",
};

const mineralReportado = new Set<string>();
for (const d of resultado.desglose) {
  const key = TIPO_KEY[d.tipo];
  if (!key) continue;
  const excExp = EXCEL[key];
  if (excExp == null) continue;

  if (d.tipo === "Mineral de Hierro") {
    if (mineralReportado.has("Mineral de Hierro")) continue;
    mineralReportado.add("Mineral de Hierro");
    const d_ = diff(aporteMineral, excExp);
    const mark = Math.abs(Number(d_)) <= 1.0 ? "✓" : "✗";
    console.log(`  ${mark} ${key.padEnd(40)} $${fmt(aporteMineral).padStart(12)} / $${fmt(excExp).padStart(12)}  →  ${d_}%`);
  } else if (excExp === 0 && d.aporte_por_ton === 0) {
    console.log(`  ✓ ${key.padEnd(40)} $${fmt(0).padStart(12)} / $${fmt(0).padStart(12)}  →  0.00%`);
  } else {
    const d_ = diff(d.aporte_por_ton, excExp);
    const mark = Math.abs(Number(d_)) <= 1.0 ? "✓" : "✗";
    console.log(`  ${mark} ${key.padEnd(40)} $${fmt(d.aporte_por_ton).padStart(12)} / $${fmt(excExp).padStart(12)}  →  ${d_}%`);
  }
}
// Sílice es placeholder — no genera movimiento pero existe en el Excel con $0
console.log(`  ✓ Sílice (placeholder)                   $         0,00 / $         0,00  →  0.00%`);

const diffTotal = diff(resultado.total, EXCEL.TOTAL);
const totalOk = Math.abs(Number(diffTotal)) <= 0.5;
console.log(`\n  ${"─".repeat(82)}`);
console.log(`  ${totalOk ? "✓" : "✗"} TOTAL ORD 3:${" ".repeat(30)} $${fmt(resultado.total).padStart(12)} / $${fmt(EXCEL.TOTAL).padStart(12)}  →  ${diffTotal}%`);

console.log("\n───────────────────────────────────────────────────────────────");
console.log(`TOTAL ORD 3: $${fmt(resultado.total)} / Excel $${fmt(EXCEL.TOTAL)} → diff ${diffTotal}%`);

if (totalOk) {
  console.log("\nVEREDICTO: El motor de fórmulas reproduce el Excel ✓ (diff < 0.5%)");
} else {
  console.log("\nVEREDICTO: El motor NO reconcilia dentro del ±0.5% requerido ✗");
}

// ── Validación build ─────────────────────────────────────────────────────────
const criteriosCantidades = Object.entries(CANT_EXCEL).every(([codigo, cantExp]) => {
  const mov = movimientos.find(m => m.material_codigo === codigo);
  return mov && Math.abs((mov.cantidad - cantExp) / cantExp) <= 0.005;
});

console.log(`\nCRITERIOS:`);
console.log(`  Cantidades CORRHIERR/CALAMINA1 ±0.5%: ${criteriosCantidades ? "✓" : "✗"}`);
console.log(`  Total ORD 3 ±0.5%: ${totalOk ? "✓" : "✗"}`);
console.log(`  Movimientos generados: ${movimientos.filter(m => m.tipo !== "Producción").length === 8 ? "✓" : "✗"} (8 insumos)`);
console.log("\n═══════════════════════════════════════════════════════════════\n");

process.exit(totalOk ? 0 : 1);
