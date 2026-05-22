// Test end-to-end de ORD 6 (Cemento UG) — cadena completa ORD 1 → 3 → 4 → 5 → 6.
// Verifica que el clinker arrastrado de ORD 5 entra correctamente al cemento.

import { describe, it, expect } from "vitest";
import { Ord01Trituracion }    from "@/lib/calc/procesos/ord01_trituracion";
import { Ord03MoliendaCrudo }  from "@/lib/calc/procesos/ord03_molienda_crudo";
import { Ord04MoliendaCarbon } from "@/lib/calc/procesos/ord04_molienda_carbon";
import { Ord05Clinkerizacion } from "@/lib/calc/procesos/ord05_clinkerizacion";
import { Ord06CementoUg }      from "@/lib/calc/procesos/ord06_cemento_ug";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";

const PROC1_ID = "proc-1";
const PROC3_ID = "proc-3";
const PROC4_ID = "proc-4";
const PROC5_ID = "proc-5";
const PROC6_ID = "proc-6";

const MAT_CALIZA_ID     = "mat-caltlvtrit";
const MAT_ARCILLA_ID    = "mat-arctlvtrit";
const MAT_MEZCPREHO_ID  = "mat-mezcpreho";
const MAT_HARINACRUD_ID = "mat-harinacrud";
const MAT_HIERRO_ID     = "mat-corrhierr";
const MAT_CALAMINA_ID   = "mat-calamina";
const MAT_CARBITUMI_ID  = "mat-carbitumi";
const MAT_CARB_MIXTO_ID = "mat-carb-mixto";
const MAT_CARBONMOL_ID  = "mat-carbonmol";
const MAT_GASOIL_ID     = "mat-gasoil";
const MAT_CLINKER_ID    = "mat-clinker001";
const MAT_YESO_ID       = "mat-yeso";
const MAT_PUZOLANA_ID   = "mat-puzolana";
const MAT_ADIT_MOL_ID   = "mat-adit-mol";

function buildContext(): CalcContext {
  const procesos: ProcesoMeta[] = [
    { id: PROC1_ID, ord: 1, material: "MEZCLA PREHOMO",    nombre: "Trituración",       orden_topologico: 1 },
    { id: PROC3_ID, ord: 3, material: "HARINA CRUDA",      nombre: "Molienda de Crudo", orden_topologico: 5 },
    { id: PROC4_ID, ord: 4, material: "CARBON MOLIDO",     nombre: "Molienda de Carbón",orden_topologico: 3 },
    { id: PROC5_ID, ord: 5, material: "CLINKER",           nombre: "Clinkerización",    orden_topologico: 6 },
    { id: PROC6_ID, ord: 6, material: "CEMENTO UG",        nombre: "Cemento UG",        orden_topologico: 7 },
  ];

  const matsList = [
    { id: MAT_CALIZA_ID,     codigo: "CALTLVTRIT", nombre: "Caliza en Prehomo",  unidad_base: "T" },
    { id: MAT_ARCILLA_ID,    codigo: "ARCTLVTRIT", nombre: "Arcilla en Prehomo", unidad_base: "T" },
    { id: MAT_MEZCPREHO_ID,  codigo: "MEZCPREHO",  nombre: "Mezcla Prehomo",     unidad_base: "T" },
    { id: MAT_HARINACRUD_ID, codigo: "HARINACRUD", nombre: "Harina Cruda",       unidad_base: "T" },
    { id: MAT_HIERRO_ID,     codigo: "CORRHIERR",  nombre: "Mineral de Hierro",  unidad_base: "T" },
    { id: MAT_CALAMINA_ID,   codigo: "CALAMINA",   nombre: "Calamina",           unidad_base: "T" },
    { id: MAT_CARBITUMI_ID,  codigo: "CARBITUMI",  nombre: "Carbón Bituminoso",  unidad_base: "T" },
    { id: MAT_CARB_MIXTO_ID, codigo: "CARB_MIXTO", nombre: "Carbón Mixto",       unidad_base: "T" },
    { id: MAT_CARBONMOL_ID,  codigo: "CARBONMOL",  nombre: "Carbón Molido",      unidad_base: "T" },
    { id: MAT_GASOIL_ID,     codigo: "GASOIL",     nombre: "Gasoil",             unidad_base: "Gal" },
    { id: MAT_CLINKER_ID,    codigo: "CLINKER001", nombre: "Clinker",            unidad_base: "T" },
    { id: MAT_YESO_ID,       codigo: "YESO00001",  nombre: "Yeso",               unidad_base: "T" },
    { id: MAT_PUZOLANA_ID,   codigo: "PUZOLANA",   nombre: "Puzolana",           unidad_base: "T" },
    { id: MAT_ADIT_MOL_ID,   codigo: "ADIT_MOL",   nombre: "Aditivo Molienda",   unidad_base: "T" },
  ];
  const materialesById     = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_CALIZA_ID}|${PERIODO}|`,         { material_id: MAT_CALIZA_ID,  proveedor: null,       periodo: PERIODO, precio: 13819.21096, unidad: "COP/Ton" }],
    [`${MAT_CALIZA_ID}|${PERIODO}|martillo`, { material_id: MAT_CALIZA_ID,  proveedor: "martillo", periodo: PERIODO, precio: 3178.41632,  unidad: "COP/Ton" }],
    [`${MAT_ARCILLA_ID}|${PERIODO}|`,        { material_id: MAT_ARCILLA_ID, proveedor: null,       periodo: PERIODO, precio: 10623.14632, unidad: "COP/Ton" }],
    [`${MAT_HIERRO_ID}|${PERIODO}|`,         { material_id: MAT_HIERRO_ID,  proveedor: null,       periodo: PERIODO, precio: 320000,      unidad: "COP/Ton" }],
    [`${MAT_CALAMINA_ID}|${PERIODO}|`,       { material_id: MAT_CALAMINA_ID,proveedor: null,       periodo: PERIODO, precio: 180000,      unidad: "COP/Ton" }],
    [`${MAT_CARBITUMI_ID}|${PERIODO}|`,      { material_id: MAT_CARBITUMI_ID,  proveedor: null,    periodo: PERIODO, precio: 180000,      unidad: "COP/Ton" }],
    [`${MAT_CARB_MIXTO_ID}|${PERIODO}|`,     { material_id: MAT_CARB_MIXTO_ID, proveedor: null,    periodo: PERIODO, precio: 150000,      unidad: "COP/Ton" }],
    [`${MAT_GASOIL_ID}|${PERIODO}|`,         { material_id: MAT_GASOIL_ID,  proveedor: null,       periodo: PERIODO, precio: 12000,       unidad: "COP/Gal" }],
    [`${MAT_YESO_ID}|${PERIODO}|`,           { material_id: MAT_YESO_ID,      proveedor: null,     periodo: PERIODO, precio: 95000,       unidad: "COP/Ton" }],
    [`${MAT_PUZOLANA_ID}|${PERIODO}|`,       { material_id: MAT_PUZOLANA_ID,  proveedor: null,     periodo: PERIODO, precio: 45000,       unidad: "COP/Ton" }],
    [`${MAT_ADIT_MOL_ID}|${PERIODO}|`,       { material_id: MAT_ADIT_MOL_ID,  proveedor: null,     periodo: PERIODO, precio: 800000,      unidad: "COP/Ton" }],
  ]);

  const pctConsumoByKey = new Map([
    [`${MAT_CALIZA_ID}|${PERIODO}|caliza`,   { material_id: MAT_CALIZA_ID, proveedor: "caliza",   periodo: PERIODO, porcentaje: 0.95 }],
    [`${MAT_CALIZA_ID}|${PERIODO}|martillo`, { material_id: MAT_CALIZA_ID, proveedor: "martillo", periodo: PERIODO, porcentaje: 0.05 }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    [`${PROC1_ID}|${PERIODO}`, {
      receta_id: "rec-1", producto_id: MAT_MEZCPREHO_ID, proceso_id: PROC1_ID, periodo: PERIODO,
      lineas: [
        { material_id: MAT_CALIZA_ID,  porcentaje: 0.7920792079207921, orden: 1 },
        { material_id: MAT_ARCILLA_ID, porcentaje: 0.2079207920792079, orden: 2 },
      ],
    }],
    [`${PROC3_ID}|${PERIODO}`, {
      receta_id: "rec-3", producto_id: MAT_HARINACRUD_ID, proceso_id: PROC3_ID, periodo: PERIODO,
      lineas: [
        { material_id: MAT_MEZCPREHO_ID, porcentaje: 0.96, orden: 1 },
        { material_id: MAT_HIERRO_ID,    porcentaje: 0.03, orden: 2 },
        { material_id: MAT_CALAMINA_ID,  porcentaje: 0.01, orden: 3 },
      ],
    }],
    [`${PROC4_ID}|${PERIODO}`, {
      receta_id: "rec-4", producto_id: MAT_CARBONMOL_ID, proceso_id: PROC4_ID, periodo: PERIODO,
      lineas: [
        { material_id: MAT_CARBITUMI_ID,  porcentaje: 0.70, orden: 1 },
        { material_id: MAT_CARB_MIXTO_ID, porcentaje: 0.30, orden: 2 },
      ],
    }],
    [`${PROC5_ID}|${PERIODO}`, {
      receta_id: "rec-5", producto_id: MAT_CLINKER_ID, proceso_id: PROC5_ID, periodo: PERIODO,
      lineas: [
        { material_id: MAT_HARINACRUD_ID, porcentaje: 0.78, orden: 1 },
        { material_id: MAT_CARBONMOL_ID,  porcentaje: 0.20, orden: 2 },
        { material_id: MAT_GASOIL_ID,     porcentaje: 0.02, orden: 3 },
      ],
    }],
    [`${PROC6_ID}|${PERIODO}`, {
      receta_id: "rec-6", producto_id: "mat-cem-ug", proceso_id: PROC6_ID, periodo: PERIODO,
      lineas: [
        { material_id: MAT_CLINKER_ID,  porcentaje: 0.75, orden: 1 },
        { material_id: MAT_YESO_ID,     porcentaje: 0.05, orden: 2 },
        { material_id: MAT_PUZOLANA_ID, porcentaje: 0.18, orden: 3 },
        { material_id: MAT_ADIT_MOL_ID, porcentaje: 0.02, orden: 4 },
      ],
    }],
  ]);

  return {
    versionId: "v",
    runId: "r",
    periodos: [PERIODO],
    procesos,
    materialesById,
    materialesByCodigo,
    preciosByMatPeriodo,
    pctConsumoByKey,
    recetasByProcesoPeriodo,
    formulaIdByCodigo: new Map([
      ["COSTO_CALIZA_MARTILLO_v1", "f-cm"],
      ["COSTO_PREHOMO_v1",         "f-pr"],
      ["COSTO_PROCESO_SUMA_v1",    "f-sm"],
      ["COSTO_MP_RECETA_v1",       "f-mp"],
    ]),
    costoProcesoByKey: new Map(),
  };
}

async function runChainToOrd5(ctx: CalcContext) {
  const writer = new InMemoryWriter();

  const r1 = await new Ord01Trituracion().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC1_ID}|${PERIODO}`, { costo_total: r1.costo_total, costo_por_ton: r1.costo_por_ton, calc_total_id: r1.calc_total_id });

  const r3 = await new Ord03MoliendaCrudo().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC3_ID}|${PERIODO}`, { costo_total: r3.costo_total, costo_por_ton: r3.costo_por_ton, calc_total_id: r3.calc_total_id });

  const r4 = await new Ord04MoliendaCarbon().run({ ctx, proceso: ctx.procesos[2], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC4_ID}|${PERIODO}`, { costo_total: r4.costo_total, costo_por_ton: r4.costo_por_ton, calc_total_id: r4.calc_total_id });

  const r5 = await new Ord05Clinkerizacion().run({ ctx, proceso: ctx.procesos[3], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC5_ID}|${PERIODO}`, { costo_total: r5.costo_total, costo_por_ton: r5.costo_por_ton, calc_total_id: r5.calc_total_id });

  return { writer, r1, r3, r4, r5 };
}

describe("Runner ORD 6 — Cemento UG", () => {
  it("Calcula tras cadena 1→3→4→5 y arrastra el clinker", async () => {
    const ctx = buildContext();
    const { r5 } = await runChainToOrd5(ctx);
    const writer6 = new InMemoryWriter();

    const r6 = await new Ord06CementoUg().run({
      ctx, proceso: ctx.procesos[4], periodo: PERIODO, writer: writer6,
    });

    // 0.75 × CLINKER + 0.05 × Yeso + 0.18 × Puzolana + 0.02 × Aditivo
    const expected = 0.75 * r5.costo_total + 0.05 * 95000 + 0.18 * 45000 + 0.02 * 800000;
    expect(r6.costo_total).toBeCloseTo(expected, 2);
    expect(r6.costo_materia_prima).toBeCloseTo(expected, 2);
  });

  it("Crea 6 log entries y 6 deps (1 cross-process al clinker)", async () => {
    const ctx = buildContext();
    const { r5 } = await runChainToOrd5(ctx);
    const writer6 = new InMemoryWriter();

    await new Ord06CementoUg().run({
      ctx, proceso: ctx.procesos[4], periodo: PERIODO, writer: writer6,
    });

    // 1 precio_componente_derivado (clinker) + 3 precio_componente_directo + costo_mp_cemento_ug + costo_proceso_total = 6
    expect(writer6.logs).toHaveLength(6);
    expect(writer6.logs.filter(l => l.calculo_tipo === "precio_componente_derivado").length).toBe(1);
    expect(writer6.logs.filter(l => l.calculo_tipo === "precio_componente_directo").length).toBe(3);
    expect(writer6.logs.find(l => l.calculo_tipo === "costo_mp_cemento_ug")).toBeDefined();
    expect(writer6.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();

    // 1 (wrapper_CLINKER → ORD5) + 4 (mp → 4 precios) + 1 (total → mp) = 6
    expect(writer6.deps).toHaveLength(6);

    const wrapperClinker = writer6.logs.find(
      l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_CLINKER_ID
    )!;
    expect(wrapperClinker.depende_de).toContain(r5.calc_total_id);
    expect(wrapperClinker.rol_dependencias?.[r5.calc_total_id]).toBe("costo_arrastrado");
  });

  it("Falla si ORD 5 no fue calculado", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();
    await expect(
      new Ord06CementoUg().run({ ctx, proceso: ctx.procesos[4], periodo: PERIODO, writer })
    ).rejects.toThrow(/ORD 5 aún no calculado|no calculado/);
  });

  it("Falla si falta receta para Cemento UG", async () => {
    const ctx = buildContext();
    await runChainToOrd5(ctx);
    ctx.recetasByProcesoPeriodo.delete(`${PROC6_ID}|${PERIODO}`);
    const writer6 = new InMemoryWriter();
    await expect(
      new Ord06CementoUg().run({ ctx, proceso: ctx.procesos[4], periodo: PERIODO, writer: writer6 })
    ).rejects.toThrow(/no hay receta/);
  });
});
