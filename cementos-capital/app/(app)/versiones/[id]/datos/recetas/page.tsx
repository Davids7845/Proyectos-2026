// Vista de recetas por proceso × periodo para una versión de presupuesto.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import RecetasAccordion from "@/components/datos/RecetasAccordion";

export default async function RecetasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // Cargar procesos ordenados topológicamente
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre, material, orden_topologico")
    .eq("activo", true)
    .order("orden_topologico");

  // Cargar recetas de esta versión
  const { data: recetas } = await supabase
    .from("recetas")
    .select("id, proceso_id, producto_id, periodo")
    .eq("version_id", id)
    .order("periodo");

  // Cargar líneas de todas las recetas de un tirón
  const recetaIds = (recetas ?? []).map(r => r.id);
  const { data: lineas } = recetaIds.length > 0
    ? await supabase
        .from("receta_lineas")
        .select("receta_id, material_id, porcentaje, orden")
        .in("receta_id", recetaIds)
        .order("orden")
    : { data: [] };

  // Cargar materiales para nombres
  const { data: materiales } = await supabase
    .from("materiales")
    .select("id, codigo, nombre, unidad_base")
    .order("nombre");

  const matById = new Map((materiales ?? []).map(m => [m.id, m]));

  // Construir estructura anidada: proceso → periodo → { receta_id, lineas }
  type Linea = { material_id: string; material_codigo: string; material_nombre: string; porcentaje: number; orden: number };
  type RecetaDato = { receta_id: string; producto_nombre: string; lineas: Linea[] };
  type ProcesoDato = { proceso_id: string; ord: number; nombre: string; recetasByPeriodo: Map<string, RecetaDato> };

  const lineasByReceta = new Map<string, Linea[]>();
  for (const ln of (lineas ?? [])) {
    const mat = matById.get(ln.material_id);
    const arr = lineasByReceta.get(ln.receta_id) ?? [];
    arr.push({
      material_id: ln.material_id,
      material_codigo: mat?.codigo ?? "?",
      material_nombre: mat?.nombre ?? ln.material_id,
      porcentaje: Number(ln.porcentaje),
      orden: ln.orden ?? 0,
    });
    lineasByReceta.set(ln.receta_id, arr);
  }

  const procesosDato: ProcesoDato[] = (procesos ?? []).map(p => {
    const recetasByPeriodo = new Map<string, RecetaDato>();
    for (const r of (recetas ?? []).filter(r => r.proceso_id === p.id)) {
      const productoMat = matById.get(r.producto_id);
      recetasByPeriodo.set(r.periodo, {
        receta_id: r.id,
        producto_nombre: productoMat?.nombre ?? r.producto_id,
        lineas: (lineasByReceta.get(r.id) ?? []).sort((a, b) => a.orden - b.orden),
      });
    }
    return { proceso_id: p.id, ord: p.ord, nombre: p.nombre, recetasByPeriodo };
  }).filter(p => p.recetasByPeriodo.size > 0);

  const totalRecetas = (recetas ?? []).length;
  const periodosUnicos = Array.from(new Set((recetas ?? []).map(r => r.periodo))).sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Recetas por proceso</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalRecetas} recetas · {procesosDato.length} procesos · {periodosUnicos.length} periodos ·{" "}
            estado <strong>{version.estado}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/versiones/${id}/datos/importar`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Importar Excel
          </Link>
        </div>
      </div>

      {totalRecetas === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">No hay recetas cargadas para esta versión.</p>
          <Link
            href={`/versiones/${id}/datos/importar`}
            className="inline-block mt-3 text-sm text-blue-600 hover:underline"
          >
            Importar desde Excel →
          </Link>
        </div>
      ) : (
        <RecetasAccordion
          versionId={id}
          procesos={procesosDato.map(p => ({
            ...p,
            recetasByPeriodo: Object.fromEntries(p.recetasByPeriodo),
          }))}
          periodos={periodosUnicos}
          editable={version.estado === "borrador"}
        />
      )}
    </div>
  );
}
