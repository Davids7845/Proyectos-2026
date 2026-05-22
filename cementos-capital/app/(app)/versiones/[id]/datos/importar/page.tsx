import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ImportForm from "@/components/datos/ImportForm";

export default async function ImportarPage({
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

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Importar</span>
      </nav>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Importar plantilla Excel</h1>
      <p className="text-sm text-gray-500 mb-6">
        Sube <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Nueva_Plantilla_Ppto_CV_V2.xlsx</code> — se leerá la hoja <strong>Datos</strong> (12 periodos Sep-2025 → Ago-2026).
      </p>

      {version.estado !== "borrador" && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm mb-4">
          Esta versión está en estado <strong>{version.estado}</strong>. Sólo versiones en borrador permiten importar.
        </div>
      )}

      <ImportForm versionId={id} disabled={version.estado !== "borrador"} />
    </div>
  );
}
