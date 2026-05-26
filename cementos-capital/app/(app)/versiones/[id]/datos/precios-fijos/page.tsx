// Vista para configurar precios fijos por proceso × periodo cuando la versión
// está en modo "Sin Consolidar" (budget_versions.precios_fijos = true).
//
// Aplica a procesos consolidables: ORD 1 (Prehomo) y ORD 2 (Caliza Triturada).
// Si una celda queda vacía, el motor cae al cálculo normal de receta.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PreciosFijosEditor from "@/components/datos/PreciosFijosEditor";

const PROCESOS_CONSOLIDABLES = [1, 2] as const;

export default async function PreciosFijosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado, periodo_inicio, periodo_fin, precios_fijos")
    .eq("id", id)
    .single();
  if (!version) notFound();

  const preciosFijos = Boolean((version as { precios_fijos?: boolean }).precios_fijos);

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .in("ord", PROCESOS_CONSOLIDABLES as unknown as number[])
    .order("ord");

  const sb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: unknown) => Promise<{ data: Array<{ proceso_id: string; periodo: string; precio_cop_ton: string | number }> | null }>;
      };
    };
  };
  const { data: overrides } = await sb
    .from("precios_fijos_overrides")
    .select("proceso_id, periodo, precio_cop_ton")
    .eq("version_id", id);

  // Lista de periodos: union de los presentes en overrides y los del rango de la versión
  const { data: preciosRows } = await supabase
    .from("precios_insumos")
    .select("periodo")
    .eq("version_id", id);
  const periodosSet = new Set<string>([
    ...(overrides ?? []).map(o => o.periodo),
    ...(preciosRows ?? []).map(r => r.periodo as string),
  ]);
  const periodos = Array.from(periodosSet).sort();

  const editable = version.estado === "borrador" && preciosFijos;

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Datos / Precios Fijos</span>
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Precios Fijos por Proceso</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Modo &quot;Sin Consolidar&quot;: el motor usa estos valores en lugar de cascadear desde la receta.
          Sólo aplica a Trituración (Prehomo) y Adiciones (Caliza Triturada).
          {!editable && (
            <span className="ml-1 text-amber-700">
              {!preciosFijos ? "(versión no está en modo Sin Consolidar)" : "(versión publicada, no editable)"}
            </span>
          )}
        </p>
      </div>

      {periodos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">
            Aún no hay periodos definidos. Importa un Excel o agrega precios para crear los periodos.
          </p>
        </div>
      ) : (
        <PreciosFijosEditor
          versionId={id}
          procesos={(procesos ?? []).map(p => ({ id: p.id, ord: p.ord, nombre: p.nombre }))}
          periodos={periodos}
          overrides={(overrides ?? []).map(o => ({
            proceso_id: o.proceso_id,
            periodo: o.periodo,
            precio_cop_ton: Number(o.precio_cop_ton),
          }))}
          editable={editable}
        />
      )}
    </div>
  );
}
