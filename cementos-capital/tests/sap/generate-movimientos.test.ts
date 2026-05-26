import { describe, it, expect } from "vitest";
import { generateMovimientos } from "@/lib/sap/generate-movimientos";

// FakeSupabase compatible with all operations used by generateMovimientos:
// delete().eq(), select().eq().in(), select().eq(), insert()
class FakeSupabase {
  readonly tables: Record<string, Record<string, unknown>[]>;

  constructor(seed: Record<string, Record<string, unknown>[]>) {
    // Shallow-copy at table level so we can mutate table arrays independently
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
    calculation_log: [
      // Semielaborado: Harina Cruda → Clinkerización (ORD 5)
      {
        id: "log-semi",
        run_id: "run1",
        calculo_tipo: "precio_componente_derivado",
        proceso_id: "proc-5",
        material_id: "mat-HARINACRUD",
        periodo: "2026-01-01",
        valor_resultado: 50_000,
        parametros_entrada: {},
      },
      // MP directo: Caliza en Clinkerización
      {
        id: "log-mp",
        run_id: "run1",
        calculo_tipo: "precio_componente_directo",
        proceso_id: "proc-5",
        material_id: "mat-CALIZATRI",
        periodo: "2026-01-01",
        valor_resultado: 10_000,
        parametros_entrada: {},
      },
      // Energía eléctrica en Clinkerización
      {
        id: "log-eng",
        run_id: "run1",
        calculo_tipo: "costo_energia_proceso",
        proceso_id: "proc-5",
        material_id: null as unknown as string,
        periodo: "2026-01-01",
        valor_resultado: 5_000,
        parametros_entrada: { kwh_ton: 100 },
      },
    ],
    recetas: [
      {
        proceso_id: "proc-5",
        periodo: "2026-01-01",
        version_id: "v1",
        receta_lineas: [
          { material_id: "mat-HARINACRUD", porcentaje: 1.55 },
          { material_id: "mat-CALIZATRI",  porcentaje: 0.05 },
        ],
      },
    ],
    rendimientos: [
      { proceso_id: "proc-5", periodo: "2026-01-01", produccion_ton: 1000, version_id: "v1" },
      { proceso_id: "proc-3", periodo: "2026-01-01", produccion_ton: 1500, version_id: "v1" },
    ],
    maestro_sap: [
      {
        material_id: "mat-CALIZATRI",
        proceso_id: "proc-5",
        clase_costo_id: "cc-mp",
        orden_sap: "700002",
        clasificacion: "Caliza",
        tipo_insumo: "Materia Prima",
      },
    ],
    procesos: [
      { id: "proc-5", ord: 5, nombre: "Clinkerización" },
      { id: "proc-3", ord: 3, nombre: "Molienda de Crudo" },
    ],
    clases_costo: [
      { id: "cc-semi",  codigo: "7199990001", denominacion: "CONSUMOS SEMIELABORADOS" },
      { id: "cc-trasl", codigo: "7999999995", denominacion: "TRASLADOS DE COSTOS" },
      { id: "cc-energ", codigo: "7405050003", denominacion: "ENERGÍA" },
      { id: "cc-mp",    codigo: "7105330101", denominacion: "CTO. MP CALIZAS NAL" },
    ],
    materiales: [
      { id: "mat-HARINACRUD", codigo: "HARINACRUD", categoria: "semielaborado", unidad_base: "T" },
      { id: "mat-CALIZATRI",  codigo: "CALIZATRI",  categoria: "materia prima",  unidad_base: "T" },
    ],
    movimientos_contables: [] as Record<string, unknown>[],
  };
}

describe("generateMovimientos (unit)", () => {
  it("genera entrada + traslado para semielaborado", async () => {
    const db = new FakeSupabase(buildSeed());
    const result = await generateMovimientos(db as any, { versionId: "v1", runId: "run1" });

    expect(result.errors).toHaveLength(0);

    const movs = db.tables["movimientos_contables"];
    // entrada (semi) + traslado (semi) + entrada (MP caliza) + entrada (energía)
    expect(movs.length).toBe(4);

    // Semielaborado entrada en ORD 5
    const entradaSemi = movs.find(m => m["material_id"] === "mat-HARINACRUD" && m["tipo_movimiento"] === "entrada");
    expect(entradaSemi).toBeDefined();
    expect(entradaSemi!["clase_costo_id"]).toBe("cc-semi");
    expect(Number(entradaSemi!["cantidad"])).toBeCloseTo(1.55 * 1000);
    expect(Number(entradaSemi!["valor_monetario"])).toBeCloseTo(50_000 * 1.55 * 1000);

    // Traslado en ORD 3 (proceso productor de HARINACRUD)
    const traslado = movs.find(m => m["material_id"] === "mat-HARINACRUD" && m["tipo_movimiento"] === "traslado");
    expect(traslado).toBeDefined();
    expect(traslado!["clase_costo_id"]).toBe("cc-trasl");
    expect(Number(traslado!["cantidad"])).toBeCloseTo(-1.55 * 1000);
    expect(traslado!["proceso_id"]).toBe("proc-3");
    expect(traslado!["valor_monetario"]).toBeNull();
  });

  it("MP directo usa clase_costo del maestro_sap", async () => {
    const db = new FakeSupabase(buildSeed());
    await generateMovimientos(db as any, { versionId: "v1", runId: "run1" });

    const entradaMP = db.tables["movimientos_contables"].find(
      m => m["material_id"] === "mat-CALIZATRI" && m["tipo_movimiento"] === "entrada"
    );
    expect(entradaMP).toBeDefined();
    expect(entradaMP!["clase_costo_id"]).toBe("cc-mp");
    expect(Number(entradaMP!["cantidad"])).toBeCloseTo(0.05 * 1000);
  });

  it("energía usa clase 7405050003 y cantidad = kwh_ton × produccion", async () => {
    const db = new FakeSupabase(buildSeed());
    await generateMovimientos(db as any, { versionId: "v1", runId: "run1" });

    const eng = db.tables["movimientos_contables"].find(m => m["tipo_movimiento"] === "entrada" && m["material_id"] === null);
    expect(eng).toBeDefined();
    expect(eng!["clase_costo_id"]).toBe("cc-energ");
    expect(Number(eng!["cantidad"])).toBeCloseTo(100 * 1000); // kwh_ton × produccion
    expect(Number(eng!["valor_monetario"])).toBeCloseTo(5_000 * 1000);
  });

  it("todos los traslados tienen cantidad negativa", async () => {
    const db = new FakeSupabase(buildSeed());
    await generateMovimientos(db as any, { versionId: "v1", runId: "run1" });

    const traslados = db.tables["movimientos_contables"].filter(m => m["tipo_movimiento"] === "traslado");
    expect(traslados.length).toBeGreaterThan(0);
    for (const t of traslados) {
      expect(Number(t["cantidad"])).toBeLessThan(0);
    }
  });

  it("idempotente: elimina movimientos previos del mismo run", async () => {
    const seed = buildSeed();
    seed.movimientos_contables.push({
      run_id: "run1", tipo_movimiento: "entrada", material_id: "stale",
      proceso_id: "proc-5", clase_costo_id: null as unknown as string, valor_monetario: 999,
    });
    const db = new FakeSupabase(seed);

    await generateMovimientos(db as any, { versionId: "v1", runId: "run1" });

    const stale = db.tables["movimientos_contables"].find(m => m["material_id"] === "stale");
    expect(stale).toBeUndefined();
    expect(db.tables["movimientos_contables"].length).toBeGreaterThan(0);
  });
});
