import type {
  CalcContext,
  CalcLogEntry,
  CalcWriter,
  Client,
  MovimientoEntry,
  ProcesoResult,
  UUID,
} from "./context";

// ─────────────────────────────────────────────────────────────────
// Writer en memoria — para tests
// ─────────────────────────────────────────────────────────────────

export class InMemoryWriter implements CalcWriter {
  logs: Array<CalcLogEntry & { id: UUID }> = [];
  costoProcesos: Array<ProcesoResult & { version_id: UUID; run_id: UUID }> = [];
  movimientos: Array<MovimientoEntry & { version_id: UUID; run_id: UUID }> = [];
  deps: Array<{ calculo_id: UUID; depende_de_id: UUID; rol_parametro: string | null }> = [];
  private seq = 0;

  async log(entry: CalcLogEntry): Promise<UUID> {
    const id = `mock-${++this.seq}`;
    this.logs.push({ ...entry, id });
    if (entry.depende_de) {
      for (const dep of entry.depende_de) {
        this.deps.push({
          calculo_id: id,
          depende_de_id: dep,
          rol_parametro: entry.rol_dependencias?.[dep] ?? null,
        });
      }
    }
    return id;
  }

  async writeCostoProceso(r: ProcesoResult, versionId: UUID, runId: UUID): Promise<void> {
    this.costoProcesos.push({ ...r, version_id: versionId, run_id: runId });
  }

  async writeMovimiento(entry: MovimientoEntry, versionId: UUID, runId: UUID): Promise<void> {
    this.movimientos.push({ ...entry, version_id: versionId, run_id: runId });
  }
}

// ─────────────────────────────────────────────────────────────────
// Writer Supabase — producción
// ─────────────────────────────────────────────────────────────────

export class SupabaseWriter implements CalcWriter {
  constructor(
    private supabase: Client,
    private ctx: Pick<CalcContext, "versionId" | "runId" | "formulaIdByCodigo">
  ) {}

  async log(entry: CalcLogEntry): Promise<UUID> {
    const formulaId = this.ctx.formulaIdByCodigo.get(entry.formula_codigo);
    if (!formulaId) {
      throw new Error(`formula_id no encontrado para código ${entry.formula_codigo}`);
    }

    const { data, error } = await this.supabase
      .from("calculation_log")
      .insert({
        run_id: this.ctx.runId,
        version_id: this.ctx.versionId,
        calculo_tipo: entry.calculo_tipo,
        proceso_id: entry.proceso_id ?? null,
        material_id: entry.material_id ?? null,
        clase_costo_id: entry.clase_costo_id ?? null,
        periodo: entry.periodo,
        concepto: entry.concepto,
        valor_resultado: entry.valor_resultado,
        unidad: entry.unidad ?? null,
        formula_id: formulaId,
        formula_expresion: entry.formula_expresion,
        parametros_entrada: entry.parametros_entrada as never,
        padre_id: null,
        nivel_jerarquia: entry.nivel_jerarquia ?? 0,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(`calculation_log insert: ${error?.message}`);

    if (entry.depende_de && entry.depende_de.length > 0) {
      const rows = entry.depende_de.map(dep => ({
        calculo_id: data.id,
        depende_de_id: dep,
        rol_parametro: entry.rol_dependencias?.[dep] ?? null,
      }));
      const { error: depErr } = await this.supabase
        .from("calculation_log_deps")
        .insert(rows);
      if (depErr) throw new Error(`calculation_log_deps insert: ${depErr.message}`);
    }

    return data.id;
  }

  async writeCostoProceso(r: ProcesoResult, versionId: UUID, runId: UUID): Promise<void> {
    const { error } = await this.supabase.from("costo_proceso").insert({
      version_id: versionId,
      run_id: runId,
      proceso_id: r.proceso_id,
      periodo: r.periodo,
      costo_materia_prima:         r.costo_materia_prima,
      costo_combustible:           r.costo_combustible,
      costo_energia:               r.costo_energia,
      costo_repuestos:             r.costo_repuestos,
      costo_servicios:             r.costo_servicios,
      costo_total:                 r.costo_total,
      costo_por_ton:               r.costo_por_ton,
      costo_recibido_arrastre:     r.costo_recibido_arrastre,
      costo_total_arrastrado:      r.costo_total_arrastrado,
      costo_por_ton_arrastrado:    r.costo_por_ton_arrastrado,
      calc_total_id: r.calc_total_id,
    });
    if (error) throw new Error(`costo_proceso insert: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async writeMovimiento(entry: MovimientoEntry, versionId: UUID, runId: UUID): Promise<void> {
    const sb = this.supabase as any;
    const { error } = await sb.from("plan_movimientos").insert({
      version_id:     versionId,
      run_id:         runId,
      proceso_id:     entry.proceso_id,
      periodo:        entry.periodo,
      tipo:           entry.tipo,
      codigo:         entry.codigo,
      nombre:         entry.nombre,
      produccion_ton: entry.produccion_ton,
      cantidad:       entry.cantidad,
      costo_unitario: entry.costo_unitario,
      valor:          entry.valor,
    });
    if (error) throw new Error(`plan_movimientos insert: ${error.message}`);
  }
}
