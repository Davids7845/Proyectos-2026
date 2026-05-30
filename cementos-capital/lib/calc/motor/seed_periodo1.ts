// Seed de datos — Período 1 (Sep-2025) para los 17 procesos calculables.
// Valores extraídos de los prompts de replicación R1–R5 (derivados a su vez
// de la hoja Datos/Base de Nueva_Plantilla_Ppto_CV_V2.xlsx).
//
// Convención de helpers:
//   casc(tipo, consumo, ordOrigen)      → cascada (el motor computa consumo × costo_origen)
//   rh(tipo, pct, humedad, aporte)      → receta_humedad; precio se back-calcula del aporte
//   dir(tipo, aporte)                   → por_ton (consumo 1); precio = aporte
//   ener(kwh, precioKwh)                → energía; aporte = kwh × precio
//   sac(sacosPorTon, aporte)            → sacos; precio_saco se back-calcula del aporte
//   ph(tipo)                            → placeholder (aporte 0)
//
// Para componentes directos sólo conocemos el aporte documentado (la celda de
// precio cruda del Excel no viene en el paquete), así que back-calculamos el
// precio que reproduce ese aporte. Las CASCADAS, en cambio, las computa el
// motor a partir del costo (también calculado) del proceso origen: ése es el
// test de integración real de la cadena topológica.

import type { RecetaComponente } from "./types";
import type { DatosProceso } from "./orquestador";

const PRECIO_KWH_COSTO = 525.15; // precio energía hoja Costo (ajuste R1)

function casc(tipo: string, consumo: number, ordOrigen: number): RecetaComponente {
  return { tipo, material_codigo: tipo, es_cascada: true, ord_origen: ordOrigen,
    receta_pct: consumo, precio: null, flete: 0, humedad: 0, unidad_calculo: "cascada" };
}
function rh(tipo: string, pct: number, humedad: number, aporte: number): RecetaComponente {
  // aporte = precio × pct × (1+humedad)  ⇒  precio = aporte / (pct × (1+humedad))
  const precio = pct > 0 ? aporte / (pct * (1 + humedad)) : 0;
  return { tipo, material_codigo: tipo, es_cascada: false, ord_origen: null,
    receta_pct: pct, precio, flete: 0, humedad, unidad_calculo: "receta_humedad" };
}
function dir(tipo: string, aporte: number): RecetaComponente {
  return { tipo, material_codigo: tipo, es_cascada: false, ord_origen: null,
    receta_pct: 1, precio: aporte, flete: 0, humedad: 0, unidad_calculo: "por_ton" };
}
function ener(kwh: number, precioKwh: number = PRECIO_KWH_COSTO): RecetaComponente {
  return { tipo: "Energía", material_codigo: "ENERGIA", es_cascada: false, ord_origen: null,
    receta_pct: kwh, precio: precioKwh, flete: 0, humedad: 0, unidad_calculo: "energia" };
}
function sac(sacosPorTon: number, aporte: number): RecetaComponente {
  const precio = sacosPorTon > 0 ? aporte / sacosPorTon : 0;
  return { tipo: "Sacos", material_codigo: "SACOS", es_cascada: false, ord_origen: null,
    receta_pct: sacosPorTon, precio, flete: 0, humedad: 0, unidad_calculo: "sacos" };
}
function ph(tipo: string): RecetaComponente {
  return { tipo, material_codigo: tipo, es_cascada: false, ord_origen: null,
    receta_pct: 0, precio: 0, flete: 0, humedad: 0, unidad_calculo: "placeholder" };
}

// Constantes de empaque/granel (R5)
const CARGUE_GRANEL = 3679.98;          // COP/Ton
const ENERGIA_EMPAQUE_KWH = 1.5;        // kWh/Ton empacadora

// Totales Excel por proceso — usados para back-calcular precio de sacos.
// El costo cascada del cemento se conoce como resultado del proceso origen;
// sac_aporte = total_empaque - total_cemento - energia_aporte.
const TOTAL_ORD6  = 100_484.39;  // Cemento UG
const TOTAL_ORD7  = 143_400.48;  // Cemento ART
const TOTAL_ORD16 = 151_371.84;  // Fibrocemento

export const SEED_PERIODO1: DatosProceso[] = [
  // ── ORD 1 — Trituración (108.900 Ton) — TOTAL 15.372,59 ───────────────────
  { ord: 1, produccion: 108_900, recetas: [
    rh("Arcilla", 0.2079, 0, 2_208.77),
    rh("Caliza",  0.7921, 0, 11_071.80),
    dir("Barras y Placas", 903.51),
    dir("Material Dique",  369.16),
    ener(1.27, 525.15),                 // 666.94
    dir("Regalías", 152.42),
  ]},

  // ── ORD 2 — Adiciones — TOTAL 16.036,45 ───────────────────────────────────
  { ord: 2, produccion: 120_000, recetas: [
    rh("Caliza", 1.0, 0, 13_978.13),
    dir("Barras y Placas", 903.51),
    dir("Material Dique",  369.16),
    ener(1.27, 525.24),                 // 667.05
    dir("Regalías", 118.59),
  ]},

  // ── ORD 3 — Molienda de Crudo (132.000 Ton) — TOTAL 31.752,89 ─────────────
  { ord: 3, produccion: 132_000, recetas: [
    casc("Prehomo",          0.8313, 1),
    casc("Caliza Adiciones", 0.1828, 2),
    rh("Mineral de Hierro", 0.0201875, 0.10,  6_680.23),  // CORRHIERR
    rh("Mineral de Hierro", 0.0035625, 0.063,   645.29),  // CALAMINA1 (mismo tipo → se suma)
    dir("Cuerpos Moledores", 167.11),
    dir("Láminas", 119.88),
    dir("Anillos, Tapas y Separadores", 498.70),
    ener(15.1, 525.15),                 // 7.929,77
    ph("Sílice"),
  ]},

  // ── ORD 4 — Molienda de Carbón (9.193,13 Ton) — TOTAL 390.317,70 ──────────
  { ord: 4, produccion: 9_193.13, recetas: [
    rh("Carbón", 0.8529, 0, 326_392.38),
    rh("Carbón", 0.2132, 0,  32_038.61),  // segundo carbón (mismo tipo → se suma)
    dir("Cuerpos Moledores y Láminas", 3_788.98),
    dir("Descargue Finos Carbón", 1_855.01),
    dir("Desatasque De Carbón", 3_861.42),
    ener(28.0, 521.36),                 // 14.598,14
    dir("Cargador Carbón", 6_743.07),
  ]},

  // ── ORD 20 — Combustibles Alternos (1.578,87 Ton) — TOTAL 342.170,16 ──────
  { ord: 20, produccion: 1_578.87, recetas: [
    rh("CDR", 0.8144, 0, 259_173.32),
    rh("Llanta Picada (TDF)", 0.1856, 0, 59_092.21),
    ph("Briquetas"),
    ph("Chip de Madera"),
    ener(8.4, 521.36),                  // 4.379,42
    dir("Cargue Alternos", 7_600.35),
    dir("Descargue Alternos", 10_725.00),
  ]},

  // ── ORD 5 — Clinkerización (82.350 Ton) — TOTAL 121.865,27 ────────────────
  { ord: 5, produccion: 82_350, recetas: [
    casc("Crudo",                 1.56,   3),
    casc("Carbón Molido",         0.1116, 4),
    casc("Combustibles Alternos", 0.0192, 20),
    ph("Ductos"),
    dir("Enfriador", 184.46),
    dir("Placas", 1_263.31),
    dir("Refractarios", 3_600.61),
    ph("Sellado"),
    dir("Gasoil", 291.44),
    dir("Cargue Clinker", 187.01),
    ph("Cargue Ck Tolva"),
    ener(30.7, 525.15),                 // 16.122,11
  ]},

  // ── ORD 6 — Cemento UG (63.731,15 Ton) — TOTAL 100.484,39 ─────────────────
  { ord: 6, produccion: 63_731.15, recetas: [
    casc("Clinker",          0.52,   5),
    casc("Caliza Triturada", 0.3878, 2),
    casc("Finos Filtro",     0.0301, 3),
    rh("Yeso",             0.0410, 0, 9_544.87),
    rh("Aditivo Molienda", 0.0005, 0, 2_198.18),
    rh("Puzolana",         0.0300, 0, 3_150.41),
    dir("Placas y Segmentos", 1_539.64),
    ener(25.7, 525.28),                 // 13.499,71
    ph("Sal Marina"), ph("Gasoil"), ph("Dosificador de Sal"),
  ]},

  // ── ORD 7 — Cemento ART (32.219,36 Ton) — TOTAL 143.400,48 ────────────────
  { ord: 7, produccion: 32_219.36, recetas: [
    casc("Clinker",          0.83,   5),
    casc("Caliza Triturada", 0.0622, 2),
    casc("Finos Filtro",     0.0300, 3),
    rh("Yeso",             0.0790, 0, 18_382.71),
    rh("Aditivo Molienda", 0.0005, 0, 2_198.18),
    dir("Placas y Segmentos", 1_492.68),
    ener(34.6, 525.28),                 // 18.174,69
    ph("Puzolana"), ph("Sal Marina"), ph("Gasoil"), ph("Dosificador de Sal"),
  ]},

  // ── ORD 16 — Fibrocemento (2.800,74 Ton) — TOTAL 151.371,84 ───────────────
  { ord: 16, produccion: 2_800.74, recetas: [
    casc("Clinker",          0.914, 5),
    casc("Caliza Triturada", 0,     2),    // consumo 0 este mes → aparece en 0
    rh("Yeso", 0.0872, 0, 20_268.11),
    dir("Placas y Segmentos", 1_492.68),
    ener(34.8, 525.28),                 // 18.279,74 (se ajusta abajo)
    ph("Finos Filtro"), ph("Sal Marina"), ph("Aditivo Molienda"),
    ph("Puzolana"), ph("Dosificador de Sal"), ph("Gasoil"),
  ]},

  // ── ORD 8 — Empaque UG 50 KG — cascada ORD 6 — TOTAL 125.368,51 ───────────
  empaque(8,  6, 20.4, 125_368.51, TOTAL_ORD6),
  // ── ORD 9 — Empaque UG 42,5 KG — cascada ORD 6 — TOTAL 128.385,45 ─────────
  empaque(9,  6, 24.0, 128_385.45, TOTAL_ORD6),
  // ── ORD 10 — Empaque UG 25 KG — cascada ORD 6 — TOTAL 135.363,89 ──────────
  empaque(10, 6, 40.8, 135_363.89, TOTAL_ORD6),
  // ── ORD 11 — Empaque ART 42,5 KG — cascada ORD 7 — TOTAL 169.665,52 ───────
  empaque(11, 7, 24.0, 169_665.52, TOTAL_ORD7),
  // ── ORD 14 — Empaque TOPEX 50 KG — cascada ORD 6 (UG) — TOTAL 128.272,82 ──
  empaque(14, 6, 20.4, 128_272.82, TOTAL_ORD6),

  // ── ORD 17 — Granel UG — cascada ORD 6 — TOTAL 104.952,29 ─────────────────
  granel(17,  6),
  // ── ORD 18 — Granel ART — cascada ORD 7 — TOTAL 147.868,39 ────────────────
  granel(18,  7),
  // ── ORD 22 — Fibro Granel — cascada ORD 16 — TOTAL 155.839,75 ─────────────
  granel(22, 16),
];

// Empaque: Cemento(cascada 1.0) + Sacos + Energía.
// produccion=1 → cantidades ya son por-ton; el motor calcula aporte/Ton directamente.
// sac_aporte = total_empaque − total_cemento − energia_aporte (back-calcula precio/saco).
function empaque(
  ord: number, ordCemento: number,
  sacosPorTon: number, total: number, totalCemento: number,
): DatosProceso {
  const energiaAporte = ENERGIA_EMPAQUE_KWH * PRECIO_KWH_COSTO; // 787.725
  const sacAporte = total - totalCemento - energiaAporte;
  return {
    ord,
    produccion: 1,
    recetas: [
      casc("Cemento", 1.0, ordCemento),
      sac(sacosPorTon, sacAporte),
      ener(ENERGIA_EMPAQUE_KWH, PRECIO_KWH_COSTO),
    ],
  };
}

// Granel: Cemento(cascada 1.0) + Energía + Cargue.
// (El TOTAL documentado se pasa sólo como anotación en la llamada; el costo lo
// computa el motor a partir de la cascada + energía + cargue, sin back-calc.)
function granel(ord: number, ordCemento: number): DatosProceso {
  return {
    ord,
    produccion: 1,
    recetas: [
      casc("Cemento", 1.0, ordCemento),
      ener(ENERGIA_EMPAQUE_KWH, PRECIO_KWH_COSTO),
      dir("Cargue Granel", CARGUE_GRANEL),
    ],
  };
}

export { CARGUE_GRANEL, ENERGIA_EMPAQUE_KWH, PRECIO_KWH_COSTO,
         TOTAL_ORD6, TOTAL_ORD7, TOTAL_ORD16,
         casc, rh, dir, ener, sac, ph };
