import { createClient } from "@/lib/supabase/server";
import ProcesosTable from "@/components/admin/ProcesosTable";

// Calculadoras implementadas (para mostrar badge en UI)
const ORDS_IMPLEMENTADOS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 19, 20, 21]);

export default async function ProcesosAdminPage() {
  const supabase = await createClient();

  const { data: procesos, error } = await supabase
    .from("procesos")
    .select("id, ord, nombre, material, orden_topologico, activo")
    .order("orden_topologico");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Procesos de producción</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {procesos?.length ?? 0} procesos · edita nombre, material de salida y orden topológico
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          {error.message}
        </div>
      )}

      <ProcesosTable
        procesos={(procesos ?? []).map(p => ({ ...p, implementado: ORDS_IMPLEMENTADOS.has(p.ord) }))}
      />
    </div>
  );
}
