// Admin: Materiales Agregados — edición de composiciones (mezclas de proveedores).
// Muestra cada agregado con sus orígenes y permite editar porcentajes / agregar / eliminar.

import { createClient } from "@/lib/supabase/server";
import MaterilesAgregadosClient from "./MaterilesAgregadosClient";

interface MaterialBase {
  id: string;
  codigo: string;
  nombre: string;
}

interface Componente {
  id: string;
  porcentaje: number;
  orden: number;
  notas: string | null;
  material_origen: MaterialBase;
}

export interface AgregadoGroup {
  material_destino: MaterialBase;
  componentes: Componente[];
  suma_porcentajes: number;
}

export default async function MaterilesAgregadosPage() {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("material_agregados")
    .select(`
      id,
      porcentaje,
      orden,
      notas,
      material_destino:materiales!material_destino_id(id, codigo, nombre),
      material_origen:materiales!material_origen_id(id, codigo, nombre)
    `)
    .order("orden");

  // Group by destino
  const byDestino = new Map<string, AgregadoGroup>();
  for (const row of (rows ?? []) as Array<{
    id: string;
    porcentaje: number;
    orden: number;
    notas: string | null;
    material_destino: MaterialBase;
    material_origen: MaterialBase;
  }>) {
    const did = row.material_destino.id;
    if (!byDestino.has(did)) {
      byDestino.set(did, { material_destino: row.material_destino, componentes: [], suma_porcentajes: 0 });
    }
    const g = byDestino.get(did)!;
    g.componentes.push({ id: row.id, porcentaje: Number(row.porcentaje), orden: row.orden, notas: row.notas, material_origen: row.material_origen });
    g.suma_porcentajes += Number(row.porcentaje);
  }

  const agregados: AgregadoGroup[] = Array.from(byDestino.values()).sort((a, b) =>
    a.material_destino.nombre.localeCompare(b.material_destino.nombre)
  );

  // All materials for dropdown (adding new components)
  const { data: allMats } = await supabase
    .from("materiales")
    .select("id, codigo, nombre")
    .order("nombre");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Materiales Agregados</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Composiciones de materiales que son mezcla de proveedores (ej. Carbón Bituminoso, CDR).
            La suma de porcentajes debería ser 100%.
          </p>
        </div>
      </div>
      <MaterilesAgregadosClient
        agregados={agregados}
        allMateriales={(allMats ?? []) as MaterialBase[]}
      />
    </div>
  );
}
