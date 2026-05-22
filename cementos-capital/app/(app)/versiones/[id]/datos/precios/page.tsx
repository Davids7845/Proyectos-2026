import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PreciosTable from "@/components/datos/PreciosTable";

export default async function PreciosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, estado, periodo_inicio, periodo_fin")
    .eq("id", id)
    .single();
  if (!version) notFound();

  const { data: precios, error } = await supabase
    .from("precios_insumos")
    .select("id, material_id, proveedor, periodo, precio_unitario, unidad")
    .eq("version_id", id)
    .order("periodo");

  const { data: materiales } = await supabase
    .from("materiales")
    .select("id, codigo, nombre, unidad_base, categoria")
    .order("nombre");

  // Lista única de periodos presentes en los datos
  const periodos = Array.from(new Set((precios ?? []).map(p => p.periodo))).sort();

  const editable = version.estado === "borrador";

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Datos / Precios</span>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Precios de insumos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {precios?.length ?? 0} registros · {periodos.length} periodos · estado <strong>{version.estado}</strong>
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error.message}
        </div>
      )}

      {(!precios || precios.length === 0) ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm mb-2">No hay precios cargados todavía.</p>
          <Link
            href={`/versiones/${id}/datos/importar`}
            className="text-sm text-blue-600 hover:underline"
          >
            Importar plantilla Excel →
          </Link>
        </div>
      ) : (
        <PreciosTable
          versionId={id}
          precios={precios}
          materiales={materiales ?? []}
          periodos={periodos}
          editable={editable}
        />
      )}
    </div>
  );
}
