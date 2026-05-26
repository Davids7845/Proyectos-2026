import { describe, it, expect } from "vitest";
import { copyCalcToReales } from "@/lib/sap/copy-calc-to-reales";

// FakeSupabase compatible con las operaciones de copyCalcToReales:
//   select().eq().eq() / select().eq() / delete().eq().in() / insert()
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

function buildSeed() {
  return {
    movimientos_contables: [
      // Entrada material (HARINACRUD en Clinkerización) Ene-2026
      {
        run_id: "run1",
        version_id: "v1",
        tipo_movimiento: "entrada",
        periodo: "2026-01-01",
        proceso_id: "proc-5",
        material_id: "mat-HARINACRUD",
        clase_costo_id: "cc-semi",
        valor_monetario: 77_500_000,    // = 50_000 * 1.55 * 1000 (precio × pct × prod)
        clasificacion: "MP",
        tipo_insumo: "Harina Cruda",
      },
      // Entrada material (CALIZATRI directa) Ene-2026
      {
        run_id: "run1",
        version_id: "v1",
        tipo_movimiento: "entrada",
        periodo: "2026-01-01",
        proceso_id: "proc-5",
        material_id: "mat-CALIZATRI",
        clase_costo_id: "cc-mp",
        valor_monetario: 500_000,
        clasificacion: "MP",
        tipo_insumo: "Caliza",
      },
      // Entrada energía (sin material) Ene-2026
      {
        run_id: "run1",
        version_id: "v1",
        tipo_movimiento: "entrada",
        periodo: "2026-01-01",
        proceso_id: "proc-5",
        material_id: null,
        clase_costo_id: "cc-energ",
        valor_monetario: 5_000_000,
        clasificacion: "ENERGIA",
        tipo_insumo: "Energía",
      },
      // Entrada fijo (regalías) Ene-2026
      {
        run_id: "run1",
        version_id: "v1",
        tipo_movimiento: "entrada",
        periodo: "2026-01-01",
        proceso_id: "proc-5",
        material_id: null,
        clase_costo_id: "cc-rep",
        valor_monetario: 200_000,
        clasificacion: "FIJO",
        tipo_insumo: "REGALIAS",
      },
      // Traslado (debe IGNORARSE — solo entradas se copian)
      {
        run_id: "run1",
        version_id: "v1",
        tipo_movimiento: "traslado",
        periodo: "2026-01-01",
        proceso_id: "proc-3",
        material_id: "mat-HARINACRUD",
        clase_costo_id: "cc-trasl",
        valor_monetario: null,
        clasificacion: null,
        tipo_insumo: null,
      },
      // Movimiento Feb-2026 (verifica copia multi-período)
      {
        run_id: "run1",
        version_id: "v1",
        tipo_movimiento: "entrada",
        periodo: "2026-02-01",
        proceso_id: "proc-5",
        material_id: "mat-HARINACRUD",
        clase_costo_id: "cc-semi",
        valor_monetario: 80_000_000,
        clasificacion: "MP",
        tipo_insumo: "Harina Cruda",
      },
    ],
    rendimientos: [
      { version_id: "v1", proceso_id: "proc-5", periodo: "2026-01-01", produccion_ton: 1000 },
      { version_id: "v1", proceso_id: "proc-5", periodo: "2026-02-01", produccion_ton: 1000 },
    ],
    materiales: [
      { id: "mat-HARINACRUD", codigo: "HARINACRUD" },
      { id: "mat-CALIZATRI",  codigo: "CALIZATRI" },
    ],
    clases_costo: [
      { id: "cc-semi",  codigo: "7199990001" },
      { id: "cc-trasl", codigo: "7999999995" },
      { id: "cc-energ", codigo: "7405050003" },
      { id: "cc-mp",    codigo: "7105330101" },
      { id: "cc-rep",   codigo: "7355250320" },
    ],
    costos_reales: [] as Record<string, unknown>[],
  };
}

describe("copyCalcToReales", () => {
  it("traduce entradas a COP/Ton dividiendo por producción", async () => {
    const db = new FakeSupabase(buildSeed());
    const report = await copyCalcToReales(db as any, { versionId: "v1", runId: "run1" });

    expect(report.errores).toHaveLength(0);
    expect(report.insertadas).toBeGreaterThan(0);

    const reales = db.tables["costos_reales"];
    const harinaEne = reales.find(
      r => r["material_id"] === "mat-HARINACRUD" && r["periodo"] === "2026-01-01"
    );
    expect(harinaEne).toBeDefined();
    expect(Number(harinaEne!["valor_monetario"])).toBeCloseTo(77_500); // 77.5M / 1000 ton
    expect(harinaEne!["concepto_tipo"]).toBe("material");
    expect(harinaEne!["concepto_codigo"]).toBe("HARINACRUD");
    expect(harinaEne!["origen"]).toBe("calc");
  });

  it("ignora traslados (solo entradas se copian)", async () => {
    const db = new FakeSupabase(buildSeed());
    await copyCalcToReales(db as any, { versionId: "v1", runId: "run1" });

    const reales = db.tables["costos_reales"];
    // Traslado HARINACRUD en proc-3 no debe aparecer
    const trasladoEnReales = reales.find(r => r["proceso_id"] === "proc-3");
    expect(trasladoEnReales).toBeUndefined();
  });

  it("clasifica correctamente: material / energia / fijo", async () => {
    const db = new FakeSupabase(buildSeed());
    await copyCalcToReales(db as any, { versionId: "v1", runId: "run1" });

    const reales = db.tables["costos_reales"];
    const energia = reales.find(r => r["concepto_tipo"] === "energia" && r["periodo"] === "2026-01-01");
    expect(energia).toBeDefined();
    expect(energia!["concepto_codigo"]).toBe("ENERGIA");
    expect(energia!["material_id"]).toBeNull();
    expect(Number(energia!["valor_monetario"])).toBeCloseTo(5_000); // 5M / 1000 ton

    const fijo = reales.find(r => r["concepto_tipo"] === "fijo" && r["periodo"] === "2026-01-01");
    expect(fijo).toBeDefined();
    expect(fijo!["concepto_codigo"]).toBe("REGALIAS");  // viene de tipo_insumo
    expect(Number(fijo!["valor_monetario"])).toBeCloseTo(200); // 200k / 1000 ton
  });

  it("filtra por período cuando se especifica", async () => {
    const db = new FakeSupabase(buildSeed());
    const report = await copyCalcToReales(db as any, {
      versionId: "v1", runId: "run1", periodo: "2026-01-01",
    });

    expect(report.periodos_procesados).toEqual(["2026-01-01"]);
    const reales = db.tables["costos_reales"];
    expect(reales.every(r => r["periodo"] === "2026-01-01")).toBe(true);
  });

  it("copia múltiples períodos cuando no se filtra", async () => {
    const db = new FakeSupabase(buildSeed());
    const report = await copyCalcToReales(db as any, { versionId: "v1", runId: "run1" });

    expect(report.periodos_procesados.sort()).toEqual(["2026-01-01", "2026-02-01"]);
  });

  it("idempotente: borra filas previas del mismo período antes de insertar", async () => {
    const seed = buildSeed();
    // Pre-existente: una fila de Excel en Ene-2026 que DEBE ser reemplazada
    seed.costos_reales.push({
      version_id: "v1",
      periodo: "2026-01-01",
      proceso_id: "proc-5",
      material_id: "mat-HARINACRUD",
      concepto_tipo: "material",
      concepto_codigo: "HARINACRUD",
      valor_monetario: 999999,
      origen: "excel",
    });
    const db = new FakeSupabase(seed);

    await copyCalcToReales(db as any, { versionId: "v1", runId: "run1" });

    const reales = db.tables["costos_reales"];
    // No debe haber rastro del valor 999999
    const stale = reales.find(r => r["valor_monetario"] === 999999);
    expect(stale).toBeUndefined();
    // Y todas las filas del período ahora son origen='calc'
    const ene = reales.filter(r => r["periodo"] === "2026-01-01");
    expect(ene.every(r => r["origen"] === "calc")).toBe(true);
  });

  it("omite procesos sin producción registrada", async () => {
    const seed = buildSeed();
    seed.movimientos_contables.push({
      run_id: "run1",
      version_id: "v1",
      tipo_movimiento: "entrada",
      periodo: "2026-01-01",
      proceso_id: "proc-99",     // sin rendimiento
      material_id: "mat-HARINACRUD",
      clase_costo_id: "cc-semi",
      valor_monetario: 1_000_000,
      clasificacion: "MP",
      tipo_insumo: "Harina",
    });
    const db = new FakeSupabase(seed);

    const report = await copyCalcToReales(db as any, { versionId: "v1", runId: "run1" });
    expect(report.omitidas).toBeGreaterThan(0);
    const reales = db.tables["costos_reales"];
    expect(reales.find(r => r["proceso_id"] === "proc-99")).toBeUndefined();
  });
});
