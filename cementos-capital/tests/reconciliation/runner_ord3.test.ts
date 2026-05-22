// Test end-to-end de ORD 3 (Molienda de Crudo) — primer proceso que arrastra
// costo de un proceso anterior (ORD 1 Prehomo).

import { describe, it, expect } from "vitest";
import { Ord01Trituracion } from "@/lib/calc/procesos/ord01_trituracion";
import { Ord03MoliendaCrudo } from "@/lib/calc/procesos/ord03_molienda_crudo";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import type { CalcContext, ProcesoMeta } from "@/lib/calc/engine/context";

const PERIODO = "2026-01-01";

// IDs ficticios
const PROC1_ID = "proc-1";
const PROC3_ID = "proc-3";
const MAT_CALIZA_ID    = "mat-caltlvtrit";
const MAT_ARCILLA_ID   = "mat-arctlvtrit";
const MAT_MEZCPREHO_ID = "mat-mezcpreho";
const MAT_HARINACRUD_ID = "mat-harinacrud";
const MAT_HIERRO_ID    = "mat-corrhierr";
const MAT_CALAMINA_ID  = "mat-calamina";

function buildContext(): CalcContext {
  const procesos: ProcesoMeta[] = [
    { id: PROC1_ID, ord: 1, material: "MEZCLA PREHOMO", nombre: "Trituración",      orden_topologico: 1 },
    { id: PROC3_ID, ord: 3, material: "HARINA CRUDA",   nombre: "Molienda de Crudo", orden_topologico: 5 },
  ];
  const matsList = [
    { id: MAT_CALIZA_ID,     codigo: "CALTLVTRIT", nombre: "Caliza en Prehomo",  unidad_base: "T" },
    { id: MAT_ARCILLA_ID,    codigo: "ARCTLVTRIT", nombre: "Arcilla en Prehomo", unidad_base: "T" },
    { id: MAT_MEZCPREHO_ID,  codigo: "MEZCPREHO",  nombre: "Mezcla Prehomo",     unidad_base: "T" },
    { id: MAT_HARINACRUD_ID, codigo: "HARINACRUD", nombre: "Harina Cruda",       unidad_base: "T" },
    { id: MAT_HIERRO_ID,     codigo: "CORRHIERR",  nombre: "Mineral de Hierro",  unidad_base: "T" },
    { id: MAT_CALAMINA_ID,   codigo: "CALAMINA",   nombre: "Calamina",           unidad_base: "T" },
  ];
  const materialesById = new Map(matsList.map(m => [m.id, m]));
  const materialesByCodigo = new Map(matsList.map(m => [m.codigo, m]));

  const preciosByMatPeriodo = new Map([
    [`${MAT_CALIZA_ID}|${PERIODO}|`,         { material_id: MAT_CALIZA_ID,  proveedor: null,       periodo: PERIODO, precio: 13819.21096, unidad: "COP/Ton" }],
    [`${MAT_CALIZA_ID}|${PERIODO}|martillo`, { material_id: MAT_CALIZA_ID,  proveedor: "martillo", periodo: PERIODO, precio: 3178.41632,  unidad: "COP/Ton" }],
    [`${MAT_ARCILLA_ID}|${PERIODO}|`,        { material_id: MAT_ARCILLA_ID, proveedor: null,       periodo: PERIODO, precio: 10623.14632, unidad: "COP/Ton" }],
    [`${MAT_HIERRO_ID}|${PERIODO}|`,         { material_id: MAT_HIERRO_ID,  proveedor: null,       periodo: PERIODO, precio: 320000,      unidad: "COP/Ton" }],
    [`${MAT_CALAMINA_ID}|${PERIODO}|`,       { material_id: MAT_CALAMINA_ID, proveedor: null,      periodo: PERIODO, precio: 180000,      unidad: "COP/Ton" }],
  ]);

  const pctConsumoByKey = new Map([
    [`${MAT_CALIZA_ID}|${PERIODO}|caliza`,   { material_id: MAT_CALIZA_ID, proveedor: "caliza",   periodo: PERIODO, porcentaje: 0.95 }],
    [`${MAT_CALIZA_ID}|${PERIODO}|martillo`, { material_id: MAT_CALIZA_ID, proveedor: "martillo", periodo: PERIODO, porcentaje: 0.05 }],
  ]);

  const recetasByProcesoPeriodo = new Map([
    // Receta Prehomo (ORD 1): caliza + arcilla
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
    // Receta Crudo (ORD 3): Prehomo + Hierro + Calamina
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

describe("Runner ORD 3 — Molienda de Crudo", () => {
  it("Calcula tras ORD 1 y consume su costo arrastrado", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    // 1) Ejecutar ORD 1 primero (necesario para que esté en costoProcesoByKey)
    const r1 = await new Ord01Trituracion().run({
      ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer,
    });
    ctx.costoProcesoByKey.set(`${PROC1_ID}|${PERIODO}`, {
      costo_total: r1.costo_total,
      costo_por_ton: r1.costo_por_ton,
      calc_total_id: r1.calc_total_id,
    });

    // 2) Ejecutar ORD 3
    const r3 = await new Ord03MoliendaCrudo().run({
      ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer,
    });

    // Expectativa: 0.96 × Prehomo + 0.03 × Hierro + 0.01 × Calamina
    // Prehomo (ORD 1 con Ene-2026) ≈ 13280.56
    // = 0.96 × 13280.56 + 0.03 × 320000 + 0.01 × 180000
    // = 12749.3376 + 9600 + 1800
    // = 24149.3376
    const expected = 0.96 * r1.costo_total + 0.03 * 320000 + 0.01 * 180000;
    expect(r3.costo_total).toBeCloseTo(expected, 2);
    expect(r3.costo_materia_prima).toBeCloseTo(expected, 2);

    // Verificar trazabilidad: precio_MEZCPREHO wrapper debe apuntar al calc_total_id de ORD 1
    const wrapperPrehomo = writer.logs.find(
      l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_MEZCPREHO_ID
    );
    expect(wrapperPrehomo).toBeDefined();
    expect(wrapperPrehomo!.depende_de).toContain(r1.calc_total_id);
    expect(wrapperPrehomo!.rol_dependencias?.[r1.calc_total_id]).toBe("costo_arrastrado");
  });

  it("Crea log entries con dependencias correctas: 3 precios + MP + total", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();

    const r1 = await new Ord01Trituracion().run({
      ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer,
    });
    ctx.costoProcesoByKey.set(`${PROC1_ID}|${PERIODO}`, {
      costo_total: r1.costo_total,
      costo_por_ton: r1.costo_por_ton,
      calc_total_id: r1.calc_total_id,
    });

    const writerOrd3 = new InMemoryWriter();
    await new Ord03MoliendaCrudo().run({
      ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer: writerOrd3,
    });

    // ORD 3 sólo debe escribir: 3 precio_componente + 1 costo_mp_crudo + 1 costo_proceso_total = 5
    expect(writerOrd3.logs).toHaveLength(5);
    expect(writerOrd3.logs.filter(l => l.calculo_tipo.startsWith("precio_componente")).length).toBe(3);
    expect(writerOrd3.logs.find(l => l.calculo_tipo === "costo_mp_crudo")).toBeDefined();
    expect(writerOrd3.logs.find(l => l.calculo_tipo === "costo_proceso_total")).toBeDefined();

    // Deps:
    //   costo_mp_crudo → cada uno de los 3 precio_componente (3 deps)
    //   costo_proceso_total → costo_mp_crudo (1 dep)
    //   precio_componente_derivado (Prehomo) → calc_total_id de ORD 1 (1 dep)
    // Total deps internos al writer de ORD 3: 3 + 1 + 1 = 5
    expect(writerOrd3.deps).toHaveLength(5);

    // El precio_MEZCPREHO debe tener rol "precio_MEZCPREHO" en el mp
    const mp = writerOrd3.logs.find(l => l.calculo_tipo === "costo_mp_crudo")!;
    const wrapperPrehomo = writerOrd3.logs.find(
      l => l.calculo_tipo === "precio_componente_derivado" && l.material_id === MAT_MEZCPREHO_ID
    )!;
    expect(mp.rol_dependencias?.[wrapperPrehomo.id]).toBe("precio_MEZCPREHO");
  });

  it("Falla con error claro si ORD 1 no fue calculado primero", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();
    // ¡No ejecutamos ORD 1!
    await expect(
      new Ord03MoliendaCrudo().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer })
    ).rejects.toThrow(/ORD 1 aún no calculado|no calculado/);
  });

  it("Falla si falta receta para el periodo", async () => {
    const ctx = buildContext();
    const writer = new InMemoryWriter();
    const r1 = await new Ord01Trituracion().run({ ctx, proceso: ctx.procesos[0], periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${PROC1_ID}|${PERIODO}`, {
      costo_total: r1.costo_total,
      costo_por_ton: r1.costo_por_ton,
      calc_total_id: r1.calc_total_id,
    });
    ctx.recetasByProcesoPeriodo.delete(`${PROC3_ID}|${PERIODO}`);
    await expect(
      new Ord03MoliendaCrudo().run({ ctx, proceso: ctx.procesos[1], periodo: PERIODO, writer })
    ).rejects.toThrow(/no hay receta/);
  });
});
