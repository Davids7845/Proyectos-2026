import type { SupabaseClient } from "@supabase/supabase-js";

// Materiales que son semielaborados internos: se consumen con clase 7199990001
// y generan un traslado inverso en el proceso productor.
const SEMIELABORADO_PRODUCTOR_ORD: Record<string, number> = {
  MEZCPREHO:  1,   // Mezcla Prehomo → ORD1 Trituración
  HARINACRUD: 3,   // Harina Cruda   → ORD3 Molienda de Crudo
  CARBONMOL:  4,   // Carbón Molido  → ORD4 Molienda de Carbón
  COMBALT:    20,  // Comb. Alternos → ORD20 Combustibles Alternos
  CLINKER001: 5,   // Clinker        → ORD5 Clinkerización
};

// Mapeo de códigos de costo fijo (parametros_entrada.codigo emitido por
// `costo_fijo_proceso`) → clase_costo.codigo. Estos códigos vienen del
// archivo Excel "Costo" (filas de repuestos / servicios / regalías por
// proceso) y NO tienen material_id, por eso no se resuelven vía maestro_sap.
// Fase 3 Sesión 1 — cierre de huérfanos.
const FIJO_CLASE_BY_CODIGO: Record<string, string> = {
  // ORD 1 — Trituración
  BARRAS_PLAC_TRIT:  "7355250320",
  MAT_DIQUE:         "7355250321",
  DESMANT_TRIT:      "7495700001",
  REGALIAS:          "7495700001",
  // ORD 2 — Adiciones
  BARRAS_PLAC_AD:    "7355250320",
  MAT_DIQUE_AD:      "7355250321",
  DESMANT_AD:        "7495700001",
  REGALIAS_AD:       "7495700001",
  // ORD 3 — Molienda de Crudo
  CUERPOS_MOL_CR:    "7355250320",
  LAMINAS_CR:        "7355250321",
  ANILLOS_TAPAS_CR:  "7355250322",
  // ORD 4 — Molienda de Carbón
  DESCARGUE_FINOS_C: "7355250321",
  CARGADOR_CARBON:   "7355250325",
  CUERPOS_MOL_C:     "7355250320",
  // ORD 5 — Clinkerización
  DUCTOS_CK:         "7355250320",
  CARGUE_CK:         "7355250324",
  SELLADO_CK:        "7355250323",
  ENFRIADOR_CK:      "7355250321",
  CARGUE_CK_TOLVA:   "7355250325",
  GASOIL_CK:         "7355050105",
  PLACAS_CK:         "7355250322",
  REFRACTARIOS_CK:   "7355300105",
  // ORD 6 — Cemento UG
  CUERPOS_MOL_UG:    "7355250320",
  PLACAS_SEG_UG:     "7355250320",
  // ORD 7 — Cemento ART
  CUERPOS_MOL_ART:   "7355250320",
  PLACAS_SEG_ART:    "7355250320",
  // ORD 16 — Fibrocemento
  CUERPOS_MOL_FIB:   "7355250320",
  PLACAS_SEG_FIB:    "7355250320",
  GASOIL_FIB:        "7355050105",
  // ORD 20 — Combustibles Alternos
  CARGUE_ALT:        "7355250324",
  DESCARGUE_ALT:     "7355250325",
  VARIABLES_ALT:     "7355250320",
};

// Calculo tipos que representan componentes individuales (excluye agregados)
const TIPOS_COMPONENTE = [
  "precio_componente_directo",
  "precio_componente_derivado",
  "costo_energia_proceso",
  "costo_componente_derivado_termico",
  "costo_fijo_proceso",
] as const;

type LogRow = {
  id: string;
  calculo_tipo: string;
  proceso_id: string | null;
  material_id: string | null;
  periodo: string;
  valor_resultado: number;
  parametros_entrada: Record<string, unknown>;
};

export type MovimientosResult = {
  generated: number;
  errors: string[];
};

export async function generateMovimientos(
  supabase: SupabaseClient,
  opts: { versionId: string; runId: string }
): Promise<MovimientosResult> {
  // ── 1. Limpiar movimientos previos del run (idempotente) ──────────────────
  await supabase.from("movimientos_contables").delete().eq("run_id", opts.runId);

  // ── 2. Cargar datos en paralelo ───────────────────────────────────────────
  const [
    { data: logsRaw, error: errLogs },
    { data: recetasRaw },
    { data: rendsRaw },
    { data: maestrosRaw },
    { data: procesosRaw },
    { data: clasesRaw },
    { data: materialesRaw },
  ] = await Promise.all([
    supabase
      .from("calculation_log")
      .select("id, calculo_tipo, proceso_id, material_id, periodo, valor_resultado, parametros_entrada")
      .eq("run_id", opts.runId)
      .in("calculo_tipo", [...TIPOS_COMPONENTE]),
    supabase
      .from("recetas")
      .select("proceso_id, periodo, receta_lineas(material_id, porcentaje)")
      .eq("version_id", opts.versionId),
    supabase
      .from("rendimientos")
      .select("proceso_id, periodo, produccion_ton")
      .eq("version_id", opts.versionId),
    supabase
      .from("maestro_sap")
      .select("material_id, proceso_id, clase_costo_id, orden_sap, clasificacion, tipo_insumo"),
    supabase.from("procesos").select("id, ord, nombre"),
    supabase.from("clases_costo").select("id, codigo, denominacion"),
    supabase.from("materiales").select("id, codigo, categoria, unidad_base"),
  ]);

  if (errLogs) throw errLogs;

  const logs = (logsRaw ?? []) as LogRow[];
  const errors: string[] = [];

  // ── 3. Índices para lookup O(1) ───────────────────────────────────────────

  // proceso_id|material_id|periodo → porcentaje
  const pctMap = new Map<string, number>();
  for (const r of recetasRaw ?? []) {
    for (const ln of (r as any).receta_lineas ?? []) {
      pctMap.set(`${r.proceso_id}|${ln.material_id}|${r.periodo}`, Number(ln.porcentaje));
    }
  }

  // proceso_id|periodo → produccion_ton
  const rendMap = new Map<string, number>();
  for (const r of rendsRaw ?? []) {
    rendMap.set(`${r.proceso_id}|${r.periodo}`, Number(r.produccion_ton ?? 0));
  }

  type SapRow = { material_id: string | null; proceso_id: string | null; clase_costo_id: string | null; orden_sap: string | null; clasificacion: string | null; tipo_insumo: string | null };
  // material_id|proceso_id → maestro_sap entry
  const sapMap = new Map<string, SapRow>();
  for (const m of maestrosRaw ?? []) {
    sapMap.set(`${m.material_id ?? ""}|${m.proceso_id ?? ""}`, m);
  }

  // ord → proceso_id
  const ordToProcId = new Map<number, string>();
  // proceso_id → ord
  const procIdToOrd = new Map<string, number>();
  for (const p of procesosRaw ?? []) {
    ordToProcId.set(p.ord, p.id);
    procIdToOrd.set(p.id, p.ord);
  }

  // codigo → clase_costo.id
  const clasesByCodigo = new Map<string, string>();
  const clasesDenomById = new Map<string, string>();
  for (const cc of clasesRaw ?? []) {
    clasesByCodigo.set(cc.codigo, cc.id);
    clasesDenomById.set(cc.id, cc.denominacion);
  }
  const claseSemiId  = clasesByCodigo.get("7199990001"); // CONSUMOS SEMIELABORADOS
  const claseTraslId = clasesByCodigo.get("7999999995"); // TRASLADOS DE COSTOS
  const claseEnergId = clasesByCodigo.get("7405050003"); // ENERGÍA

  // material.id → { codigo, categoria, unidad_base }
  const matById = new Map<string, { codigo: string; categoria: string; unidad_base: string }>();
  for (const m of materialesRaw ?? []) {
    matById.set(m.id, { codigo: m.codigo, categoria: m.categoria, unidad_base: m.unidad_base ?? "T" });
  }

  // ── 4. Generar movimientos ────────────────────────────────────────────────
  const movimientos: Record<string, unknown>[] = [];

  for (const log of logs) {
    if (!log.proceso_id) continue;

    const produccion = rendMap.get(`${log.proceso_id}|${log.periodo}`) ?? 0;
    if (produccion === 0) {
      errors.push(`Sin producción: proceso=${log.proceso_id} periodo=${log.periodo}`);
      continue;
    }

    const procesoOrd = procIdToOrd.get(log.proceso_id);
    const centroCosto = procesoOrd === 1 ? "IA01" : "EC01";
    const fechaDoc = lastDayOfMonth(log.periodo);

    // ── A. Componentes de materia prima (precio_componente_*) ──────────────
    if (
      log.calculo_tipo === "precio_componente_directo" ||
      log.calculo_tipo === "precio_componente_derivado"
    ) {
      if (!log.material_id) continue;

      const pct = pctMap.get(`${log.proceso_id}|${log.material_id}|${log.periodo}`);
      if (pct == null) {
        errors.push(`Sin pct: proceso=${log.proceso_id} material=${log.material_id} periodo=${log.periodo}`);
        continue;
      }

      const matInfo = matById.get(log.material_id);
      const matCodigo = matInfo?.codigo ?? "";
      const esSemi = matCodigo in SEMIELABORADO_PRODUCTOR_ORD;

      const sapEntry = sapMap.get(`${log.material_id}|${log.proceso_id}`);
      const claseCostoId = esSemi
        ? (claseSemiId ?? null)
        : (sapEntry?.clase_costo_id ?? null);

      const cantidad   = pct * produccion;
      const valorTotal = log.valor_resultado * cantidad;

      const sap = sapEntry;
      const ordenSap = sap?.orden_sap ?? null;
      const clasificacion = sap?.clasificacion ?? null;
      const tipoInsumo = sap?.tipo_insumo ?? (matInfo?.categoria ?? null);
      const concatenado = `${claseCostoId ?? ""}|${matCodigo}`;

      movimientos.push({
        version_id:     opts.versionId,
        run_id:         opts.runId,
        periodo:        log.periodo,
        clase_costo_id: claseCostoId,
        material_id:    log.material_id,
        proceso_id:     log.proceso_id,
        orden_sap:      ordenSap,
        centro_costo:   centroCosto,
        tipo_movimiento: "entrada",
        valor_monetario: valorTotal,
        cantidad:       cantidad,
        unidad:         matInfo?.unidad_base ?? "T",
        clasificacion,
        tipo_insumo:    tipoInsumo,
        arrastre_a:     null,
        calc_id:        log.id,
        concatenado,
        fecha_contabilizacion: fechaDoc,
        fecha_documento:       fechaDoc,
        denominacion_clase_contrapartida: claseCostoId ? clasesDenomById.get(claseCostoId) ?? null : null,
      });

      // Traslado en el proceso productor para semielaborados
      // valor_monetario es -valorTotal: el productor "descarga" el valor que
      // el consumidor recibe, cuadrando Debe/Haber por par (Fase 3 Sesión 2).
      if (esSemi) {
        const productorOrd = SEMIELABORADO_PRODUCTOR_ORD[matCodigo];
        const productorId  = ordToProcId.get(productorOrd);
        if (productorId) {
          movimientos.push({
            version_id:      opts.versionId,
            run_id:          opts.runId,
            periodo:         log.periodo,
            clase_costo_id:  claseTraslId ?? null,
            material_id:     log.material_id,
            proceso_id:      productorId,
            tipo_movimiento: "traslado",
            valor_monetario: -valorTotal,
            cantidad:        -cantidad,
            unidad:          matInfo?.unidad_base ?? "T",
            traslado_desde:  productorId,
            traslado_hasta:  log.proceso_id,
            calc_id:         log.id,
            fecha_contabilizacion: fechaDoc,
            fecha_documento:       fechaDoc,
            denominacion_clase_contrapartida: claseTraslId ? clasesDenomById.get(claseTraslId) ?? null : null,
          });
        }
      }
      continue;
    }

    // ── B. Energía eléctrica ──────────────────────────────────────────────
    if (log.calculo_tipo === "costo_energia_proceso") {
      const kwh_ton = Number(log.parametros_entrada.kwh_ton ?? 0);
      const cantidad   = kwh_ton * produccion;
      const valorTotal = log.valor_resultado * produccion;

      movimientos.push({
        version_id:     opts.versionId,
        run_id:         opts.runId,
        periodo:        log.periodo,
        clase_costo_id: claseEnergId ?? null,
        material_id:    null,
        proceso_id:     log.proceso_id,
        tipo_movimiento: "entrada",
        valor_monetario: valorTotal,
        cantidad:        cantidad,
        unidad:          "kWh",
        clasificacion:   "ENERGIA",
        tipo_insumo:     "Energía Eléctrica",
        centro_costo:    centroCosto,
        calc_id:         log.id,
        fecha_contabilizacion: fechaDoc,
        fecha_documento:       fechaDoc,
        denominacion_clase_contrapartida: claseEnergId ? clasesDenomById.get(claseEnergId) ?? null : null,
      });
      continue;
    }

    // ── C. Combustible derivado térmico (Carbón Molido, Alternos) ─────────
    if (log.calculo_tipo === "costo_componente_derivado_termico") {
      if (!log.material_id) continue;
      const consumo    = Number(log.parametros_entrada.consumo ?? 0);
      const cantidad   = consumo * produccion;
      const valorTotal = log.valor_resultado * produccion;

      const matInfo  = matById.get(log.material_id);
      const matCodigo = matInfo?.codigo ?? "";
      const sapEntry  = sapMap.get(`${log.material_id}|${log.proceso_id}`);

      movimientos.push({
        version_id:     opts.versionId,
        run_id:         opts.runId,
        periodo:        log.periodo,
        clase_costo_id: claseSemiId ?? null,
        material_id:    log.material_id,
        proceso_id:     log.proceso_id,
        orden_sap:      sapEntry?.orden_sap ?? null,
        centro_costo:   centroCosto,
        tipo_movimiento: "entrada",
        valor_monetario: valorTotal,
        cantidad:        cantidad,
        unidad:          matInfo?.unidad_base ?? "T",
        clasificacion:   sapEntry?.clasificacion ?? matCodigo,
        tipo_insumo:     sapEntry?.tipo_insumo ?? "Combustible",
        calc_id:         log.id,
        fecha_contabilizacion: fechaDoc,
        fecha_documento:       fechaDoc,
        denominacion_clase_contrapartida: claseSemiId ? clasesDenomById.get(claseSemiId) ?? null : null,
      });

      // Traslado si el combustible es un semielaborado (Carbón Molido, Alternos)
      // valor_monetario es -valorTotal: cuadre Debe/Haber (Fase 3 Sesión 2).
      if (matCodigo in SEMIELABORADO_PRODUCTOR_ORD) {
        const productorOrd = SEMIELABORADO_PRODUCTOR_ORD[matCodigo];
        const productorId  = ordToProcId.get(productorOrd);
        if (productorId) {
          movimientos.push({
            version_id:      opts.versionId,
            run_id:          opts.runId,
            periodo:         log.periodo,
            clase_costo_id:  claseTraslId ?? null,
            material_id:     log.material_id,
            proceso_id:      productorId,
            tipo_movimiento: "traslado",
            valor_monetario: -valorTotal,
            cantidad:        -cantidad,
            unidad:          matInfo?.unidad_base ?? "T",
            traslado_desde:  productorId,
            traslado_hasta:  log.proceso_id,
            calc_id:         log.id,
            fecha_contabilizacion: fechaDoc,
            fecha_documento:       fechaDoc,
            denominacion_clase_contrapartida: claseTraslId ? clasesDenomById.get(claseTraslId) ?? null : null,
          });
        }
      }
      continue;
    }

    // ── D. Costos fijos (repuestos, servicios, regalías) ──────────────────
    if (log.calculo_tipo === "costo_fijo_proceso") {
      const valorTotal = log.valor_resultado * produccion;
      const codigo = String(log.parametros_entrada.codigo ?? "");

      // Resolver clase_costo por el código del item fijo (Fase 3 Sesión 1).
      // Antes: lookup vía maestro_sap con material_id=null → siempre null.
      const claseCodigo = FIJO_CLASE_BY_CODIGO[codigo];
      const claseCostoId = claseCodigo ? clasesByCodigo.get(claseCodigo) ?? null : null;

      movimientos.push({
        version_id:     opts.versionId,
        run_id:         opts.runId,
        periodo:        log.periodo,
        clase_costo_id: claseCostoId,
        material_id:    log.material_id ?? null,
        proceso_id:     log.proceso_id,
        centro_costo:   centroCosto,
        tipo_movimiento: "entrada",
        valor_monetario: valorTotal,
        cantidad:        produccion,
        unidad:          "T",
        clasificacion:   "FIJO",
        tipo_insumo:     codigo || "Costo Fijo",
        calc_id:         log.id,
        fecha_contabilizacion: fechaDoc,
        fecha_documento:       fechaDoc,
        denominacion_clase_contrapartida: claseCostoId ? clasesDenomById.get(claseCostoId) ?? null : null,
      });
    }
  }

  // ── 5. Insertar en batch (máx 500 filas por llamada) ─────────────────────
  const BATCH = 500;
  for (let i = 0; i < movimientos.length; i += BATCH) {
    const slice = movimientos.slice(i, i + BATCH);
    const { error } = await supabase.from("movimientos_contables").insert(slice);
    if (error) throw new Error(`movimientos_contables insert batch ${i}: ${error.message}`);
  }

  return { generated: movimientos.length, errors };
}

function lastDayOfMonth(periodo: string): string {
  const d = new Date(periodo + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}
