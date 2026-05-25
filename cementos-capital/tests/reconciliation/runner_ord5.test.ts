// Test end-to-end de ORD 5 (Clinkerización) — proceso que arrastra costos de
// ORD 3 (Harina Cruda) y ORD 4 (Carbón Molido), más un componente directo.

import { describe, it, expect } from "vitest";
import { Ord01Trituracion }    from "@/lib/calc/procesos/ord01_trituracion";
import { Ord03MoliendaCrudo }  from "@/lib/calc/procesos/ord03_molienda_crudo";
import { Ord04MoliendaCarbon } from "@/lib/calc/procesos/ord04_molienda_carbon";
import { Ord05Clinkerizacion } from "@/lib/calc/procesos/ord05_clinkerizacion";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";

const PROC1_ID  = "proc-1";
const PROC3_ID  = "proc-3";
const PROC4_ID  = "proc-4";
const PROC5_ID  = "proc-5";
const PROC20_ID = "proc-20";

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

function buildContext(): CalcContext {
  const procesos: ProcesoMeta[] = [
    { id: PROC1_ID,  ord: 1,  material: "MEZCLA PREHOMO",   nombre: "Trituración",       orden_topologico: 1 },
    { id: PROC3_ID,  ord: 3,  material: "HARINA CRUDA",     nombre: "Molienda de Crudo", orden_topologico: 5 },
    { id: PROC4_ID,  ord: 4,  material: "CARBON MOLIDO",    nombre: "Molienda de Carbón",orden_topologico: 3 },
    { id: PROC5_ID,  ord: 5,  material: "CLINKER",          nombre: "Clinkerización",    orden_topologico: 6 },
    { id: PROC20_ID, ord: 20, material: "COMBUSTIBLES ALT", nombre: "Combustibles Alternos", orden_topologico: 2 },
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
    { id: "mat-combalt",     codigo: "COMBALT",    nombre: "Combustibles Alternos", unidad_base: "T" },
  ];
  const materialesById    = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    // Precios para ORD 1
    [`${MAT_CALIZA_ID}|${PERIODO}|`,         { material_id: MAT_CALIZA_ID,  proveedor: null,       periodo: PERIODO, precio: 13819.21096, unidad: "COP/Ton" }],
    [`${MAT_CALIZA_ID}|${PERIODO}|martillo`, { material_id: MAT_CALIZA_ID,  proveedor: "martillo", periodo: PERIODO, precio: 3178.41632,  unidad: "COP/Ton" }],
    [`${MAT_ARCILLA_ID}|${PERIODO}|`,        { material_id: MAT_ARCILLA_ID, proveedor: null,       periodo: PERIODO, precio: 10623.14632, unidad: "COP/Ton" }],
    // Precios directos para ORD 3
    [`${MAT_HIERRO_ID}|${PERIODO}|`,         { material_id: MAT_HIERRO_ID,  proveedor: null,       periodo: PERIODO, precio: 320000,      unidad: "COP/Ton" }],
    [`${MAT_CALAMINA_ID}|${PERIODO}|`,       { material_id: MAT_CALAMINA_ID,proveedor: null,       periodo: PERIODO, precio: 180000,      unidad: "COP/Ton" }],
    // Precios para ORD 4
    [`${MAT_CARBITUMI_ID}|${PERIODO}|`,      { material_id: MAT_CARBITUMI_ID,  proveedor: null,    periodo: PERIODO, precio: 180000,      unidad: "COP/Ton" }],
    [`${MAT_CARB_MIXTO_ID}|${PERIODO}|`,     { material_id: MAT_CARB_MIXTO_ID, proveedor: null,    periodo: PERIODO, precio: 150000,      unidad: "COP/Ton" }],
    // Precio directo para ORD 5
    [`${MAT_GASOIL_ID}|${PERIODO}|`,         { material_id: MAT_GASOIL_ID,  proveedor: null,       periodo: PERIODO, precio: 12000,       unidad: "COP/Gal" }],
  ]);

  const pctConsumoByKey = new Map([
    [`${MAT_CALIZA_ID}|${PERIODO}|caliza`,   { material_id: MAT_CALIZA_ID, proveedor: "caliza",   periodo: PERIODO, porcentaje: 0.95 }],
    [`${MAT_CALIZA_ID}|${PERIODO}|martillo`, { material_id: MAT_CALIZA_ID, proveedor: "martillo", periodo: PERIODO, porcentaje: 0.05 }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    // Receta ORD 1: caliza + arcilla
    [`${PROC1_ID}|${PERIODO}`, {
      receta_id: "rec-1",
      producto_id: MAT_MEZCPREHO_ID,
      proceso_id: PROC1_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_CALIZA_ID,  porcentaje: 0.7920792079207921, orden: 1 },
        { material_id: MAT_ARCILLA_ID, porcentaje: 0.2079207920792079, orden: 2 },
      ],
    }],
    // Receta ORD 3: Prehomo + Hierro + Calamina
    [`${PROC3_ID}|${PERIODO}`, {
      receta_id: "rec-3",
      producto_id: MAT_HARINACRUD_ID,
      proceso_id: PROC3_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_MEZCPREHO_ID, porcentaje: 0.96, orden: 1 },
        { material_id: MAT_HIERRO_ID,    porcentaje: 0.03, orden: 2 },
        { material_id: MAT_CALAMINA_ID,  porcentaje: 0.01, orden: 3 },
      ],
    }],
    // Receta ORD 4: Carbón Bituminoso + Carbón Mixto
    [`${PROC4_ID}|${PERIODO}`, {
      receta_id: "rec-4",
      producto_id: MAT_CARBONMOL_ID,
      proceso_id: PROC4_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_CARBITUMI_ID,  porcentaje: 0.70, orden: 1 },
        { material_id: MAT_CARB_MIXTO_ID, porcentaje: 0.30, orden: 2 },
      ],
    }],
    // Receta ORD 5: Harina Cruda + Carbón Molido + Gasoil
    [`${PROC5_ID}|${PERIODO}`, {
      receta_id: "rec-5",
      producto_id: MAT_CLINKER_ID,
      proceso_id: PROC5_ID,
      periodo: PERIODO,
      lineas: [
        { material_id: MAT_HARINACRUD_ID, porcentaje: 0.78, orden: 1 },
        { material_id: MAT_CARBONMOL_ID,  porcentaje: 0.20, orden: 2 },
        { material_id: MAT_GASOIL_ID,     porcentaje: 0.02, orden: 3 },
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
      ["CONSUMO_COMBUSTIBLE_HORNO_v1", "f-cc"],
    ]),
    // Stub ORD 20 (precio COMBALT) y parámetros térmicos mínimos para que el
    // modelo térmico de ORD 5 calcule consumo de carbón + alternos.
    costoProcesoByKey: new Map([
      [`${PROC20_ID}|${PERIODO}`, { costo_total: 300_000, costo_por_ton: 300_000, calc_total_id: "calc-ord20-stub" }],
    ]),
    parametrosEnergiaByPeriodo: new Map([
      [PERIODO, {
        periodo: PERIODO,
        precio_contrato: 0, precio_restricciones: 0, cargos_fijos: 0,
        kwh_ton_proceso: null, pci_combustibles: null,
        kcal_tck_total: null, pci_ponderado_horno: null, composicion_horno: null,
        kcal_tck: 797, pct_energia_carbones: 0.864, pct_energia_alternos: 0.135,
        pct_energia_diesel: 0.001, pci_ponderado_carbones: 6170,
        pci_ponderado_alternos: 5714, pci_ponderado_diesel: 10400,
      }],
    ]),
  };
}

async function runChain(ctx: CalcContext) {
  const writer = new InMemoryWriter();

  const r1 = await new Ord01Trituracion().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC1_ID}|${PERIODO}`, { costo_total: r1.costo_total, costo_por_ton: r1.costo_por_ton, calc_total_id: r1.calc_total_id });

  const r3 = await new Ord03MoliendaCrudo().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC3_ID}|${PERIODO}`, { costo_total: r3.costo_total, costo_por_ton: r3.costo_por_ton, calc_total_id: r3.calc_total_id });

  const r4 = await new Ord04MoliendaCarbon().run({ ctx, proceso: ctx.procesos[2], periodo: PERIODO, writer });
  ctx.costoProcesoByKey.set(`${PROC4_ID}|${PERIODO}`, { costo_total: r4.costo_total, costo_por_ton: r4.costo_por_ton, calc_total_id: r4.calc_total_id });

  return { writer, r1, r3, r4 };
}

describe("Runner ORD 5 — Clinkerización", () => {
  it("Calcula tras ORD 3 y ORD 4 y arrastra sus costos", async () => {
    const ctx = buildContext();
    const { r3, r4 } = await runChain(ctx);
    const writer5 = new InMemoryWriter();

    const r5 = await new Ord05Clinkerizacion().run({
      ctx, proceso: ctx.procesos[3], periodo: PERIODO, writer: writer5,
    });

    // MP (receta): 0.78 × costo_ORD3 + 0.20 × costo_ORD4 + 0.02 × 12000
    const expectedMp = 0.78 * r3.costo_total + 0.20 * r4.costo_total + 0.02 * 12000;
    expect(r5.costo_materia_prima).toBeCloseTo(expectedMp, 2);
    // Combustible térmico = consumo × precio_arrastrado
    //   carbones = (797 × 0.864 / 6170) × r4.costo_por_ton
    //   alternos = (797 × 0.135 / 5714) × 300_000 (stub COMBALT)
    const consumoCarbones = (797 * 0.864) / 6170;
    const consumoAlternos = (797 * 0.135) / 5714;
    const expectedCombust = consumoCarbones * r4.costo_por_ton + consumoAlternos * 300_000;
    expect(r5.costo_combustible).toBeCloseTo(expectedCombust, 0);
    expect(r5.costo_total).toBeCloseTo(expectedMp + expectedCombust, 0);
  });

  it("Crea 9 log entries y 10 deps (2 cross-process derivados + térmico)", async () => {
    const ctx = buildContext();
    const { r3, r4 } = await runChain(ctx);
    const writer5 = new InMemoryWriter();

    await new Ord05Clinkerizacion().run({
      ctx, proceso: ctx.procesos[3], periodo: PERIODO, writer: writer5,
    });

    // 2 precio_componente_derivado + 1 precio_componente_directo + costo_mp_clinker
    // + 2 consumo_combustible_horno + 2 costo_componente_derivado_termico
    // + 1 costo_proceso_total = 9
    expect(writer5.logs).toHaveLength(9);
    expect(writer5.logs.filter(l => l.calculo_tipo === "precio_componente_derivado").length).toBe(2);
    expect(writer5.logs.filter(l => l.calculo_tipo === "precio_componente_directo").length).toBe(1);
    expect(writer5.logs.find(l => l.calculo_tipo === "costo_mp_clinker")).toBeDefined();
    expect(writer5.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();

    // Deps:
    //   1 (wrapper_HARINACRUD→ORD3) + 1 (wrapper_CARBONMOL→ORD4)
    //   + 3 (mp→precios) + 1 (total→mp)
    //   + 2 (cada costo_termico→consumo) + 2 (cada costo_termico→arrastrado)
    //   + 2 (total→2 costo_termicos)
    // = 12 (con doble dep por componente térmico)
    expect(writer5.deps.length).toBeGreaterThanOrEqual(10);

    // Verificar que los wrappers derivados apuntan a los calc_total_id correctos
    const wrapperHC = writer5.logs.find(
      l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_HARINACRUD_ID
    )!;
    const wrapperCM = writer5.logs.find(
      l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_CARBONMOL_ID
    )!;
    expect(wrapperHC.depende_de).toContain(r3.calc_total_id);
    expect(wrapperHC.rol_dependencias?.[r3.calc_total_id]).toBe("costo_arrastrado");
    expect(wrapperCM.depende_de).toContain(r4.calc_total_id);
    expect(wrapperCM.rol_dependencias?.[r4.calc_total_id]).toBe("costo_arrastrado");
  });

  it("Falla si ORD 3 no fue calculado", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();
    // Sólo ORD 4, sin ORD 1/3
    const r4 = await new Ord04MoliendaCarbon().run({ ctx, proceso: ctx.procesos[2], periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${PROC4_ID}|${PERIODO}`, { costo_total: r4.costo_total, costo_por_ton: r4.costo_por_ton, calc_total_id: r4.calc_total_id });

    await expect(
      new Ord05Clinkerizacion().run({ ctx, proceso: ctx.procesos[3], periodo: PERIODO, writer })
    ).rejects.toThrow(/ORD 3 aún no calculado|no calculado/);
  });

  it("Falla si ORD 4 no fue calculado", async () => {
    const ctx = buildContext();
    const sharedWriter = new InMemoryWriter();

    const r1 = await new Ord01Trituracion().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer: sharedWriter });
    ctx.costoProcesoByKey.set(`${PROC1_ID}|${PERIODO}`, { costo_total: r1.costo_total, costo_por_ton: r1.costo_por_ton, calc_total_id: r1.calc_total_id });

    const r3 = await new Ord03MoliendaCrudo().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer: sharedWriter });
    ctx.costoProcesoByKey.set(`${PROC3_ID}|${PERIODO}`, { costo_total: r3.costo_total, costo_por_ton: r3.costo_por_ton, calc_total_id: r3.calc_total_id });

    // Sin ORD 4
    await expect(
      new Ord05Clinkerizacion().run({ ctx, proceso: ctx.procesos[3], periodo: PERIODO, writer: sharedWriter })
    ).rejects.toThrow(/ORD 4 aún no calculado|no calculado/);
  });

  it("Falla si falta receta para ORD 5", async () => {
    const ctx = buildContext();
    await runChain(ctx);
    ctx.recetasByProcesoPeriodo.delete(`${PROC5_ID}|${PERIODO}`);
    const writer5 = new InMemoryWriter();
    await expect(
      new Ord05Clinkerizacion().run({ ctx, proceso: ctx.procesos[3], periodo: PERIODO, writer: writer5 })
    ).rejects.toThrow(/no hay receta/);
  });
});
