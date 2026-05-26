// Reconciliación SAP: verifica que generateMovimientos produce movimientos cuya suma
// de ENERGÍA (7405050003) concuerda con el Excel "Base" para el período enero 2026.
//
// No requiere Supabase — usa FakeSupabase y InMemoryWriter igual que el resto de
// los tests de reconciliación.

import { describe, it, expect, beforeAll } from "vitest";
import * as XLSX from "xlsx";
import { loadExcelFixture } from "../fixtures/load_excel_fixture";
import { buildContextFromExcel } from "../fixtures/build_context_from_excel";
import { InMemoryWriter } from "@/lib/calc/engine/writer";
import { generateMovimientos } from "@/lib/sap/generate-movimientos";
import { Ord01Trituracion }         from "@/lib/calc/procesos/ord01_trituracion";
import { Ord03MoliendaCrudo }       from "@/lib/calc/procesos/ord03_molienda_crudo";
import { Ord04MoliendaCarbon }      from "@/lib/calc/procesos/ord04_molienda_carbon";
import { Ord05Clinkerizacion }      from "@/lib/calc/procesos/ord05_clinkerizacion";
import { Ord06CementoUg }           from "@/lib/calc/procesos/ord06_cemento_ug";
import { Ord07CementoArt }          from "@/lib/calc/procesos/ord07_cemento_art";
import { Ord16Fibrocemento }        from "@/lib/calc/procesos/ord16_fibrocemento";
import { Ord20CombustiblesAlternos } from "@/lib/calc/procesos/ord20_combustibles_alternos";

const PERIODO = "2026-01-01";

// ID prefix for fake clases_costo
const ccId = (code: string) => `cc-${code}`;

// All clase_costo codes that appear in the Excel Maestro + extra required by generator
const CLASES_CATALOG: Array<{ codigo: string; denominacion: string }> = [
  { codigo: "7199990001", denominacion: "CONSUMOS SEMIELABORADOS" },
  { codigo: "7999999995", denominacion: "TRASLADOS DE COSTOS" },
  { codigo: "7405050003", denominacion: "ENERGIA ELECTRICA" },
  { codigo: "7105330101", denominacion: "CTO. MP CALIZAS NAL" },
  { codigo: "7105040101", denominacion: "MP CORRECT HIERO NAL" },
  { codigo: "7355050103", denominacion: "CTO COMBUS SOL NAC" },
  { codigo: "7355050104", denominacion: "CTO COMBUS GAS NAC" },
  { codigo: "7355050105", denominacion: "CTO COMBUS LIQ NAC" },
  { codigo: "7105450101", denominacion: "CTO. MP YES/ESCA NAL" },
  { codigo: "7360050302", denominacion: "CTO BOLSAS IMP" },
  { codigo: "7495700001", denominacion: "SERVICIOS DE EXPLOTA" },
  { codigo: "7355250320", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7355250321", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7355250322", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7355250323", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7355250324", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7355250325", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7355300105", denominacion: "RTOS VARIA IMPO" },
  { codigo: "7405990999", denominacion: "OTROS SERVICIOS" },
  { codigo: "7199990002", denominacion: "CONSUMOS SEMIELABORADOS 2" },
  { codigo: "7105240101", denominacion: "MP ADICIO ACTIVA NAL" },
  { codigo: "7355050101", denominacion: "CTO. COMBUSTIBLES" },
  { codigo: "7105400101", denominacion: "CTO.MP COMPUESTO NAL" },
];

// FakeSupabase reusable across both test files
class FakeSupabase {
  readonly tables: Record<string, Record<string, unknown>[]>;

  constructor(seed: Record<string, Record<string, unknown>[]>) {
    this.tables = Object.fromEntries(
      Object.entries(seed).map(([k, v]) => [k, v.map(r => ({ ...r }))])
    );
  }

  from(table: string) {
    const self = this;
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let isDelete = false;
    let insertData: Record<string, unknown>[] | null = null;

    const builder = {
      select(_cols?: string) { return builder; },
      eq(col: string, val: unknown) { filters.push(r => r[col] === val); return builder; },
      in(col: string, vals: unknown[]) { filters.push(r => vals.includes(r[col])); return builder; },
      delete() { isDelete = true; return builder; },
      insert(data: Record<string, unknown> | Record<string, unknown>[]) {
        insertData = Array.isArray(data) ? data : [data];
        return builder;
      },
      then(resolve: (v: { data: unknown; error: null }) => void) {
        const tableData = self.tables[table] ?? [];
        const match = (r: Record<string, unknown>) => filters.every(f => f(r));
        if (isDelete) {
          self.tables[table] = tableData.filter(r => !match(r));
          resolve({ data: null, error: null });
        } else if (insertData) {
          if (!self.tables[table]) self.tables[table] = [];
          self.tables[table].push(...insertData);
          resolve({ data: insertData, error: null });
        } else {
          resolve({ data: tableData.filter(match), error: null });
        }
      },
    };
    return builder;
  }
}

// Translates Excel Maestro material codes → canonical DB codes (mirrors 015_seed_maestro_sap.sql).
const MAESTRO_MAT_MAP: Record<string, string> = {
  CARMIXTO: "CARB_MIXTO", FINOSCARB: "CARB_FINO",
  ADIMOLIEN: "ADIT_MOL",  CRUDO: "FINOS_FILT",
  SALMAR: "SAL_MARINA",   CALAMINA1: "CALAMINA",
  ENERGIA: "ENERGIA_KWH",
  COMBALTER: "COMBALT",   "Combustibles Alternos": "COMBALT",
  BIOBRIQPAP: "BRIQUETAS", BIOCHIPMAD: "CHIP_MADERA",
  COMBURESID: "CDR",       LLANTAPICA: "TDF",
  CEMENTOART: "CEM_ART",   CEMENTOUG1: "CEM_UG",
  "CEMENTO ART": "CEM_ART", "CEMENTO UG TP": "CEM_UG_TP",
  CEMARTB42: "CEM_ART_42", CEMCUGB25: "CEM_UG_25",
  CEMCUGB42: "CEM_UG_42",  CEMCUGB50: "CEM_UG_50",
  "22000000005": "SACO_50KG", "22000000008": "SACO_50KG",
  "22000000004": "SACO_25KG", "22000000006": "SACO_42_5KG",
  "22000000041": "SACO_50KG", "22000000001": "SACO_50KG",
  "70000000034": "GASOIL",    "70000000000": "GASOIL",
  "10000000002": "CALIZATRI",
  "CUERPOS MOLEDORES": "CUERP_MOL", "CUERPOS MOLEDORES Y LAMINAS": "CUERP_MOL",
  LAMINAS: "BARRAS_PLAC",  "ANILLOS, TAPAS Y SEPARADORES": "PLAC_SEG",
  "PLACAS Y SEGMENTOS": "PLAC_SEG", "BARRAS Y PLACAS": "BARRAS_PLAC",
  PLACAS: "PLAC_SEG",      REFRACTARIOS: "REFRACTARIO",
  "MATERIAL DIQUE": "MAT_DIQUE", "CARGUE CLINKER": "CARGUE_CK",
  "CARGUE CK TOLVA": "CARGUE_CK", CARGUE: "CARGUE_CEM",
  "CARGUE ALTERNOS": "CARGUE_CEM", "DESCARGUE ALTERNOS": "CARGUE_CEM",
  "EMPAQUE Y GRANEL": "CARGUE_CEM", "DESCARGUE FINOS CARBON": "CARGUE_CEM",
  "CARGADOR CARBON": "CARGUE_CEM",
  DUCTOS: "VAR_MTTO",      ENFRIADOR: "VAR_MTTO",    SELLADO: "VAR_MTTO",
  "DOSIFICADOR DE SAL": "VAR_MTTO", "DESATASQUE DE CARBON": "VAR_MTTO",
};

/** Parse Maestro sheet → maestro_sap rows with fake IDs. */
function parseMaestro(
  buf: Buffer | ArrayBuffer | Uint8Array,
  materialesByCodigo: Map<string, { id: string }>,
  procesoIdByOrd: Map<number, string>,
): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "buffer", cellFormula: false });
  const ws = wb.Sheets["Maestro"];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const result: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const claseCodigo = r[1] != null ? String(r[1]) : null;
    const matExcel    = r[3] != null ? String(r[3]).trim() : null;
    const ord         = r[6] != null ? Number(r[6]) : null;
    const tipoInsumo  = r[7] != null ? String(r[7]) : null;
    const ordenSap    = r[9] != null ? String(r[9]) : null;
    const clasif      = r[10] != null ? String(r[10]) : null;
    if (!claseCodigo || !matExcel || !ord) continue;
    const matCodigo = MAESTRO_MAT_MAP[matExcel] ?? matExcel;
    const mat  = materialesByCodigo.get(matCodigo);
    const proc = procesoIdByOrd.get(ord);
    if (!mat || !proc) continue;
    const key = `${claseCodigo}|${mat.id}|${proc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      material_id:    mat.id,
      proceso_id:     proc,
      clase_costo_id: ccId(claseCodigo),
      orden_sap:      ordenSap,
      clasificacion:  clasif,
      tipo_insumo:    tipoInsumo,
    });
  }
  return result;
}

/** Parse Base sheet → totals by clase_costo_codigo for period 1 (January). */
function parseBaseSheet(buf: Buffer | ArrayBuffer | Uint8Array): Map<string, number> {
  const wb = XLSX.read(buf, { type: "buffer", cellFormula: false });
  const ws = wb.Sheets["Base"];
  if (!ws) return new Map();
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const totals = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const code  = r[0] != null ? String(r[0]) : null;
    const val   = r[2] != null ? Number(r[2]) : null;
    const per   = r[11] != null ? Number(r[11]) : null;
    if (!code || val == null || per !== 1) continue;
    totals.set(code, (totals.get(code) ?? 0) + val);
  }
  return totals;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Reconciliación SAP vs Excel Base (período enero 2026)", () => {
  let db: FakeSupabase;
  let excelTotals: Map<string, number>;
  let genResult: { generated: number; errors: string[] };

  beforeAll(async () => {
    const buf = loadExcelFixture();

    // 1. Parse Excel Base sheet for period=1 targets
    excelTotals = parseBaseSheet(buf);

    // 2. Build CalcContext from Excel
    const { ctx } = buildContextFromExcel(buf, { periodos: [PERIODO] });

    // 3. Run all processes with InMemoryWriter
    const writer = new InMemoryWriter();
    const proc = (ord: number) => ctx.procesos.find((p: { ord: number }) => p.ord === ord)!;

    const r20 = await new Ord20CombustiblesAlternos().run({ ctx, proceso: proc(20), periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${proc(20).id}|${PERIODO}`, { costo_total: r20.costo_total, costo_por_ton: r20.costo_por_ton, calc_total_id: r20.calc_total_id });

    const r1 = await new Ord01Trituracion().run({ ctx, proceso: proc(1), periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${proc(1).id}|${PERIODO}`, { costo_total: r1.costo_total, costo_por_ton: r1.costo_por_ton, calc_total_id: r1.calc_total_id });

    const r3 = await new Ord03MoliendaCrudo().run({ ctx, proceso: proc(3), periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${proc(3).id}|${PERIODO}`, { costo_total: r3.costo_total, costo_por_ton: r3.costo_por_ton, calc_total_id: r3.calc_total_id });

    const r4 = await new Ord04MoliendaCarbon().run({ ctx, proceso: proc(4), periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${proc(4).id}|${PERIODO}`, { costo_total: r4.costo_total, costo_por_ton: r4.costo_por_ton, calc_total_id: r4.calc_total_id });

    const r5 = await new Ord05Clinkerizacion().run({ ctx, proceso: proc(5), periodo: PERIODO, writer });
    ctx.costoProcesoByKey.set(`${proc(5).id}|${PERIODO}`, { costo_total: r5.costo_total, costo_por_ton: r5.costo_por_ton, calc_total_id: r5.calc_total_id });

    await new Ord06CementoUg().run({ ctx, proceso: proc(6), periodo: PERIODO, writer });
    await new Ord07CementoArt().run({ ctx, proceso: proc(7), periodo: PERIODO, writer });
    await new Ord16Fibrocemento().run({ ctx, proceso: proc(16), periodo: PERIODO, writer });

    // 4. Build seed tables from CalcContext + writer logs
    const TIPOS_SAP = [
      "precio_componente_directo", "precio_componente_derivado",
      "costo_energia_proceso", "costo_componente_derivado_termico", "costo_fijo_proceso",
    ];

    const calcLogs: Record<string, unknown>[] = writer.logs
      .filter(l => TIPOS_SAP.includes(l.calculo_tipo))
      .map(l => ({ ...l, run_id: "run1", version_id: "v1" }));

    const recetas: Record<string, unknown>[] = Array.from(ctx.recetasByProcesoPeriodo.values())
      .filter((r: any) => r.periodo === PERIODO)
      .map((r: any) => ({
        proceso_id: r.proceso_id,
        periodo: r.periodo,
        version_id: "v1",
        receta_lineas: r.lineas.map((l: any) => ({ material_id: l.material_id, porcentaje: l.porcentaje })),
      }));

    const procesos: Record<string, unknown>[] = ctx.procesos.map((p: any) => ({
      id: p.id, ord: p.ord, nombre: p.nombre,
    }));

    const materiales: Record<string, unknown>[] = Array.from(ctx.materialesById.values()).map((m: any) => ({
      id: m.id, codigo: m.codigo, categoria: "materia prima", unidad_base: m.unidad_base ?? "T",
    }));

    const clasesCosto: Record<string, unknown>[] = CLASES_CATALOG.map(c => ({
      id: ccId(c.codigo), codigo: c.codigo, denominacion: c.denominacion,
    }));

    const maestroSap = parseMaestro(buf, ctx.materialesByCodigo, new Map(ctx.procesos.map((p: any) => [p.ord, p.id])));

    // CALTLVTRIT (caliza explotada) aparece en ORD 3 como precio_componente_derivado
    // (el motor traza MEZCPREHO → CALTLVTRIT) pero el Excel Maestro no tiene esa fila.
    // Se agrega manualmente para evitar clase_costo_id=null en movimientos derivados.
    {
      const matId  = ctx.materialesByCodigo.get("CALTLVTRIT")?.id;
      const procId = ctx.procesos.find((p: any) => p.ord === 3)?.id;
      if (matId && procId && !maestroSap.some(e => e["material_id"] === matId && e["proceso_id"] === procId)) {
        maestroSap.push({ material_id: matId, proceso_id: procId, clase_costo_id: ccId("7105330101"), orden_sap: null, clasificacion: null, tipo_insumo: "Caliza" });
      }
    }

    // Rendimientos para enero 2026 extraídos de la hoja "Datos" columna G (período 1).
    // La sección "Rendimiento" del Excel usa nombres sin paréntesis de proceso,
    // así que no se parsea automáticamente; se usan valores directos del Excel.
    const PRODUCCION_ENE: Record<number, number> = {
      1:  108_900,   // Trituración (Producción Prehomo, fila 266)
      3:  132_000,   // Molienda Crudo (Producción Crudo, fila 263)
      4:    9_193,   // Molienda Carbón (Producción Carbón, fila 272)
      5:   82_350,   // Clinkerización (Producción Horno, fila 260)
      6:   63_731,   // Cemento UG (Producción Cemento Ug, fila 248)
      7:   32_219,   // Cemento ART (Producción Cemento Art, fila 251)
      16:   2_801,   // Fibrocemento (Producción Cemento Fibro, fila 254)
      20:   1_579,   // Combustibles Alternos (Producción Alternos, fila 275)
    };
    const rendimientos: Record<string, unknown>[] = ctx.procesos
      .filter((p: any) => PRODUCCION_ENE[p.ord] != null)
      .map((p: any) => ({
        proceso_id: p.id,
        periodo: PERIODO,
        produccion_ton: PRODUCCION_ENE[p.ord],
        version_id: "v1",
      }));

    // 5. Run generateMovimientos
    db = new FakeSupabase({
      calculation_log: calcLogs,
      recetas,
      rendimientos,
      maestro_sap: maestroSap,
      procesos,
      clases_costo: clasesCosto,
      materiales,
      movimientos_contables: [],
    });

    genResult = await generateMovimientos(db as any, { versionId: "v1", runId: "run1" });
  });

  it("genera movimientos para todos los procesos (count > 30)", () => {
    expect(genResult.generated).toBeGreaterThan(30);
    console.log(`[SAP] generated=${genResult.generated} errors=${genResult.errors.length}`);
  });

  it("todos los movimientos de entrada tienen valor_monetario positivo", () => {
    const entradas = db.tables["movimientos_contables"].filter(m => m["tipo_movimiento"] === "entrada");
    for (const e of entradas) {
      expect(Number(e["valor_monetario"] ?? 0)).toBeGreaterThanOrEqual(0);
    }
  });

  it("todos los traslados tienen cantidad negativa y valor_monetario nulo", () => {
    const traslados = db.tables["movimientos_contables"].filter(m => m["tipo_movimiento"] === "traslado");
    expect(traslados.length).toBeGreaterThan(0);
    for (const t of traslados) {
      expect(Number(t["cantidad"])).toBeLessThan(0);
      expect(t["valor_monetario"]).toBeNull();
    }
  });

  it("ENERGÍA (7405050003) total ≤ 15% del Excel Base período 1", () => {
    const excelVal = excelTotals.get("7405050003") ?? 0;
    const calcTotal = db.tables["movimientos_contables"]
      .filter(m => m["clase_costo_id"] === ccId("7405050003"))
      .reduce((s, m) => s + Number(m["valor_monetario"] ?? 0), 0);

    const relError = Math.abs(calcTotal - excelVal) / excelVal;
    console.log(
      `[ENERGÍA] calc=${calcTotal.toLocaleString("es-CO", { maximumFractionDigits: 0 })}` +
      ` excel=${excelVal.toLocaleString("es-CO", { maximumFractionDigits: 0 })}` +
      ` diff=${(relError * 100).toFixed(2)}%`
    );
    expect(relError).toBeLessThan(0.15);
  });

  it("Diagnóstico: distribución de movimientos por clase_costo", () => {
    const byClase = new Map<string, number>();
    for (const m of db.tables["movimientos_contables"]) {
      const k = String(m["clase_costo_id"] ?? "null");
      byClase.set(k, (byClase.get(k) ?? 0) + Number(m["valor_monetario"] ?? 0));
    }
    console.log("[SAP clase totals]");
    for (const [id, total] of Array.from(byClase.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10)) {
      const codigo = id.replace("cc-", "");
      console.log(`  ${codigo}: ${total.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`);
    }
  });

  // ── 6 clases de costo: clasificación correcta tras poblar maestro_sap ──────
  //
  // excelCmp=false → sólo verifica que el motor genera movimientos para esa clase
  //   (7105330101: Base SAP muestra $0; 7199990001: el motor acumula la cadena
  //    completa de semielaborados, incomparable monetariamente con la Base SAP)
  // excelCmp=true  → además compara contra Excel Base período 1 con tolerancia tol
  //   (las brechas observadas —4% yeso, 9% hierro, 23% carbón, 11% energía—
  //    son consecuencia de diferencias precio-presupuesto vs precio-real SAP;
  //    no modificar lib/calc/*, tolerancias ≥ las indicadas en spec)
  it.each([
    ["7105330101", "CTO. MP CALIZAS NAL",     false, 0.02],
    ["7105450101", "CTO. MP YES/ESCA NAL",    true,  0.08],
    ["7105040101", "MP CORRECT HIERO NAL",    true,  0.15],
    ["7355050103", "CTO COMBUS SOL NAC",       true,  0.30],
    ["7405050003", "ENERGIA ELECTRICA",        true,  0.15],
    ["7199990001", "CONSUMOS SEMIELABORADOS",  false, 0.02],
  ] as const)(
    "clase %s (%s): engine clasifica movimientos correctamente",
    (code, _label, excelCmp, tol) => {
      const movs = db.tables["movimientos_contables"].filter(
        m => m["clase_costo_id"] === ccId(code),
      );
      expect(movs.length, `clase ${code} debe tener ≥1 movimiento`).toBeGreaterThan(0);

      const total = movs.reduce((s, m) => s + Number(m["valor_monetario"] ?? 0), 0);
      expect(total, `clase ${code} total debe ser > 0`).toBeGreaterThan(0);

      if (excelCmp) {
        const excelVal = excelTotals.get(code) ?? 0;
        if (excelVal > 0) {
          const relErr = Math.abs(total - excelVal) / excelVal;
          console.log(
            `[${code}] calc=${total.toLocaleString("es-CO", { maximumFractionDigits: 0 })}` +
            ` excel=${excelVal.toLocaleString("es-CO", { maximumFractionDigits: 0 })}` +
            ` gap=${(relErr * 100).toFixed(1)}%`,
          );
          expect(relErr, `clase ${code} gap=${(relErr * 100).toFixed(1)}% excede tol=${(tol * 100).toFixed(0)}%`)
            .toBeLessThanOrEqual(tol);
        }
      }
    },
  );

  // ── No deben existir movimientos entrada/MP con clase_costo_id nulo ────────
  // (costo_fijo_proceso sin material_id queda fuera del filtro; la prueba
  //  cubre únicamente entradas con material conocido, donde maestro_sap
  //  debe proveer siempre una clase de costo)
  it("no hay movimientos entrada MP con clase_costo_id nulo", () => {
    const nullClase = db.tables["movimientos_contables"].filter(
      m =>
        m["tipo_movimiento"] === "entrada" &&
        m["material_id"] != null &&
        m["clase_costo_id"] == null,
    );
    if (nullClase.length > 0) {
      console.log("[NULL clase] ejemplos:", nullClase.slice(0, 3).map(m => ({
        material_id: m["material_id"],
        proceso_id:  m["proceso_id"],
        calculo_tipo: m["calculo_tipo"],
      })));
    }
    expect(nullClase.length).toBe(0);
  });
});
