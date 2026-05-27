import { createClient } from "@/lib/supabase/server";
import MaterialesTable from "@/components/admin/MaterialesTable";

export default async function MaterialesAdminPage() {
  const supabase = await createClient();

  const [{ data: materiales, error }, { data: ultimaVersion }] = await Promise.all([
    supabase
      .from("materiales")
      .select("id, codigo, nombre, unidad_base, categoria, tipo_insumo, activo")
      .order("categoria")
      .order("nombre"),
    supabase
      .from("budget_versions")
      .select("id, nombre")
      .eq("estado", "calculado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const categorias = Array.from(new Set((materiales ?? []).map(m => m.categoria).filter(Boolean))).sort() as string[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Materiales</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {materiales?.length ?? 0} materiales · click en celda para editar
            {ultimaVersion && (
              <span className="ml-2 text-gray-400">
                · Análisis de impacto contra: <strong>{ultimaVersion.nombre}</strong>
              </span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error.message}
        </div>
      )}

      <MaterialesTable
        materiales={materiales ?? []}
        categorias={categorias}
        versionIdParaImpacto={ultimaVersion?.id ?? null}
      />
    </div>
  );
}
