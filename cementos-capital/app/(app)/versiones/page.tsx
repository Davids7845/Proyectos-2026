import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NuevaVersionButton from "@/components/calc/NuevaVersionButton";
import CompareButton from "@/components/calc/CompareButton";

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  borrador:    { label: "Borrador",    color: "bg-gray-100 text-gray-700" },
  calculando:  { label: "Calculando",  color: "bg-yellow-100 text-yellow-700" },
  calculado:   { label: "Calculado",   color: "bg-green-100 text-green-700" },
  congelado:   { label: "Congelado",   color: "bg-blue-100 text-blue-700" },
  archivado:   { label: "Archivado",   color: "bg-red-100 text-red-700" },
};

export default async function VersionesPage() {
  const supabase = await createClient();
  const { data: versiones, error } = await supabase
    .from("budget_versions")
    .select("*")
    .order("creado_en", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Versiones de Presupuesto
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cada versión define su propio rango de meses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(versiones?.length ?? 0) >= 2 && (
            <CompareButton versiones={(versiones ?? []).map(v => ({ id: v.id, nombre: v.nombre }))} />
          )}
          <NuevaVersionButton />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
          Error al cargar versiones: {error.message}
        </div>
      )}

      {!versiones || versiones.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">
            No hay versiones todavía.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Crea una nueva versión o importa la plantilla Excel.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Período</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SAP</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Creado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {versiones.map((v) => {
                const estado = ESTADO_LABELS[v.estado] ?? { label: v.estado, color: "bg-gray-100" };
                return (
                  <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link
                        href={`/versiones/${v.id}`}
                        className="hover:text-blue-700 hover:underline"
                      >
                        {v.nombre}
                      </Link>
                      {v.descripcion && (
                        <p className="text-xs text-gray-500 font-normal">{v.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 tabular-nums">
                      {new Date(v.fecha_inicio ?? v.periodo_inicio).toLocaleDateString("es-CO", { month: "short", year: "numeric", timeZone: "UTC" })}
                      {" – "}
                      {new Date(v.fecha_fin ?? v.periodo_fin).toLocaleDateString("es-CO", { month: "short", year: "numeric", timeZone: "UTC" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${estado.color}`}>
                        {estado.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.sap_enabled ? "Sí" : "No"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(v.creado_en).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/versiones/${v.id}/datos/precios`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Datos
                        </Link>
                        <Link
                          href={`/versiones/${v.id}/costo`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Costo
                        </Link>
                        <Link
                          href={`/versiones/${v.id}/calcular`}
                          className="text-green-600 hover:underline text-xs"
                        >
                          Calcular
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
