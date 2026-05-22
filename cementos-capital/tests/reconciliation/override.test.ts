// Tests del override + propagación.
// Como applyOverride/clearOverride hacen llamadas reales a Supabase, mockeamos
// un cliente que mantiene 4 tablas en memoria: calculation_log, calculation_log_deps,
// formula_definitions, costo_proceso.

import { describe, it, expect, beforeEach } from "vitest";
import { applyOverride, clearOverride } from "@/lib/calc/engine/override";

type Row = Record<string, any>;

class FakeSupabase {
  tables: Record<string, Row[]> = {
    calculation_log: [],
    calculation_log_deps: [],
    formula_definitions: [],
    costo_proceso: [],
  };

  from(table: string) {
    const self = this;
    const rows = () => self.tables[table];
    let filters: Array<(r: Row) => boolean> = [];
    let updateData: Row | null = null;
    let selectCols: string | null = null;

    const builder: any = {
      select(cols: string) { selectCols = cols; return builder; },
      eq(col: string, val: any) { filters.push(r => r[col] === val); return builder; },
      in(col: string, vals: any[]) { filters.push(r => vals.includes(r[col])); return builder; },
      update(data: Row) { updateData = data; return builder; },
      then(resolve: any) {
        const matching = rows().filter(r => filters.every(f => f(r)));
        if (updateData) for (const m of matching) Object.assign(m, updateData);
        resolve({ data: matching, error: null });
      },
      single() {
        const matching = rows().filter(r => filters.every(f => f(r)));
        return Promise.resolve({ data: matching[0] ?? null, error: matching[0] ? null : { message: "not found" } });
      },
    };
    return builder;
  }
}

const SUPA = () => new FakeSupabase() as any;

// ─── Helpers ─────────────────────────────────────────────────────

function seedOrd1Tree(s: FakeSupabase) {
  // Fórmulas
  s.tables.formula_definitions.push(
    { id: "f-cm", codigo: "COSTO_CALIZA_MARTILLO_v1" },
    { id: "f-pr", codigo: "COSTO_PREHOMO_v1" },
    { id: "f-sm", codigo: "COSTO_PROCESO_SUMA_v1" },
  );

  // Nodos: total ← mp_prehomo ← caliza_martillo
  s.tables.calculation_log.push(
    {
      id: "n-cm", calculo_tipo: "precio_caliza_martillo", version_id: "v",
      valor_resultado: "13978.131776",
      parametros_entrada: { precio_caliza: 13819.21096, costo_martillo: 3178.41632, pct_caliza: 0.95, pct_martillo: 0.05 },
      es_override: false, valor_original: null, motivo_override: null,
      formula_id: "f-cm", proceso_id: "p1", periodo: "2026-01-01",
    },
    {
      id: "n-mp", calculo_tipo: "costo_mp_prehomo", version_id: "v",
      valor_resultado: "13280.56",
      parametros_entrada: { precio_caliza_martillo: 13978.131776, precio_arcilla: 10623.14632, pct_caliza: 0.7920792079207921, pct_arcilla: 0.2079207920792079 },
      es_override: false, valor_original: null, motivo_override: null,
      formula_id: "f-pr", proceso_id: "p1", periodo: "2026-01-01",
    },
    {
      id: "n-total", calculo_tipo: "costo_proceso_total", version_id: "v",
      valor_resultado: "13280.56",
      parametros_entrada: { costo_mp: 13280.56 },
      es_override: false, valor_original: null, motivo_override: null,
      formula_id: "f-sm", proceso_id: "p1", periodo: "2026-01-01",
    },
  );

  // Dependencias: n-mp depende de n-cm; n-total depende de n-mp
  s.tables.calculation_log_deps.push(
    { calculo_id: "n-mp", depende_de_id: "n-cm", rol_parametro: "precio_caliza_martillo" },
    { calculo_id: "n-total", depende_de_id: "n-mp", rol_parametro: "costo_mp" },
  );

  // costo_proceso apuntando a n-total
  s.tables.costo_proceso.push({
    id: "cp-1", version_id: "v", run_id: "r", proceso_id: "p1", periodo: "2026-01-01",
    costo_total: "13280.56", costo_por_ton: "13280.56",
    costo_total_arrastrado: "13280.56", costo_por_ton_arrastrado: "13280.56",
    calc_total_id: "n-total",
  });
}

// ─── Tests ───────────────────────────────────────────────────────

describe("applyOverride", () => {
  it("Override en hoja se propaga hacia ancestros y actualiza costo_proceso", async () => {
    const s = SUPA();
    seedOrd1Tree(s);

    // Override del precio caliza+martillo: de 13978.131776 → 15000
    const result = await applyOverride(s, "n-cm", 15000, "ajuste estratégico");

    expect(result.nodos_actualizados).toBe(1);
    expect(result.ancestros_recalculados).toBe(2); // n-mp y n-total
    expect(result.costo_proceso_actualizado).toBe(1);
    expect(result.warnings).toHaveLength(0);

    // n-cm: nuevo valor + flag override
    const ncm = s.tables.calculation_log.find((r: Row) => r.id === "n-cm")!;
    expect(Number(ncm.valor_resultado)).toBe(15000);
    expect(ncm.es_override).toBe(true);
    expect(Number(ncm.valor_original)).toBeCloseTo(13978.131776, 4);
    expect(ncm.motivo_override).toBe("ajuste estratégico");

    // n-mp: recalculado con el nuevo precio_caliza_martillo
    // Esperado: 15000 × 0.79208 + 10623.14632 × 0.20792 ≈ 14089.92
    const nmp = s.tables.calculation_log.find((r: Row) => r.id === "n-mp")!;
    const expectedMp = 15000 * 0.7920792079207921 + 10623.14632 * 0.2079207920792079;
    expect(Number(nmp.valor_resultado)).toBeCloseTo(expectedMp, 4);
    expect(nmp.es_override).toBe(false); // ancestro recalculado, NO marcado

    // n-total propagado igual a n-mp (la fórmula del total es identidad en ORD 1)
    const ntot = s.tables.calculation_log.find((r: Row) => r.id === "n-total")!;
    expect(Number(ntot.valor_resultado)).toBeCloseTo(expectedMp, 4);

    // costo_proceso actualizado
    const cp = s.tables.costo_proceso[0];
    expect(Number(cp.costo_total)).toBeCloseTo(expectedMp, 4);
    expect(Number(cp.costo_por_ton)).toBeCloseTo(expectedMp, 4);
  });

  it("Override sobre nodo ya overrideado preserva valor_original", async () => {
    const s = SUPA();
    seedOrd1Tree(s);

    await applyOverride(s, "n-cm", 15000, "primer ajuste");
    const original1 = s.tables.calculation_log.find((r: Row) => r.id === "n-cm")!.valor_original;

    await applyOverride(s, "n-cm", 16000, "segundo ajuste");
    const ncm = s.tables.calculation_log.find((r: Row) => r.id === "n-cm")!;
    expect(Number(ncm.valor_resultado)).toBe(16000);
    expect(ncm.valor_original).toBe(original1); // se preservó el valor original original
    expect(ncm.motivo_override).toBe("segundo ajuste");
  });
});

describe("clearOverride", () => {
  it("Restaura valor original y re-propaga", async () => {
    const s = SUPA();
    seedOrd1Tree(s);

    // Override → cambia el árbol completo
    await applyOverride(s, "n-cm", 15000, "test");
    expect(Number(s.tables.calculation_log.find((r: Row) => r.id === "n-total")!.valor_resultado))
      .not.toBeCloseTo(13280.56, 2);

    // Restaurar
    const result = await clearOverride(s, "n-cm");
    expect(result.nodos_actualizados).toBe(1);
    expect(result.ancestros_recalculados).toBe(2);

    const ncm = s.tables.calculation_log.find((r: Row) => r.id === "n-cm")!;
    expect(Number(ncm.valor_resultado)).toBeCloseTo(13978.131776, 4);
    expect(ncm.es_override).toBe(false);
    expect(ncm.valor_original).toBeNull();

    const ntot = s.tables.calculation_log.find((r: Row) => r.id === "n-total")!;
    expect(Number(ntot.valor_resultado)).toBeCloseTo(13280.56, 2);
  });

  it("Throws si el nodo no está overrideado", async () => {
    const s = SUPA();
    seedOrd1Tree(s);
    await expect(clearOverride(s, "n-cm")).rejects.toThrow(/no está overrideado/);
  });
});
