import type { SupabaseClient } from "@supabase/supabase-js";
import { MATERIAL_AGREGADOS_SEED } from "./material_agregados_seed";

/**
 * Puebla la tabla `material_agregados` con las composiciones hardcoded del Excel.
 * Opera con upsert para ser idempotente. Retorna número de entradas pobladas.
 */
export async function poblarMaterialAgregados(
  supabase: SupabaseClient,
): Promise<number> {
  const { data: mats, error } = await supabase
    .from("materiales")
    .select("id, codigo");
  if (error || !mats) return 0;

  const codigoToId = new Map<string, string>(mats.map(m => [m.codigo, m.id]));
  let total = 0;

  for (const [destinoCodigo, origenes] of Object.entries(MATERIAL_AGREGADOS_SEED)) {
    const destinoId = codigoToId.get(destinoCodigo);
    if (!destinoId) {
      console.warn(`[material_agregados] Destino no encontrado: ${destinoCodigo}`);
      continue;
    }
    for (const [origenCodigo, porcentaje, orden] of origenes) {
      const origenId = codigoToId.get(origenCodigo);
      if (!origenId) {
        console.warn(`[material_agregados] Origen no encontrado: ${origenCodigo}`);
        continue;
      }
      const { error: upsertErr } = await supabase
        .from("material_agregados")
        .upsert(
          { material_destino_id: destinoId, material_origen_id: origenId, porcentaje, orden },
          { onConflict: "material_destino_id,material_origen_id" },
        );
      if (!upsertErr) total++;
    }
  }
  return total;
}
