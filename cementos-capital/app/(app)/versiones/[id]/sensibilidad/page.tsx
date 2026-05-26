// Vista de análisis de sensibilidad — Fase 2b Módulo 2.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import SensibilidadForm from "@/components/sensibilidad/SensibilidadForm";

export default async function SensibilidadPage({
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

  // Lista materiales (todos), enriquecidos con un precio referencial (último periodo)
  const { data: materiales } = await supabase
    .from("materiales")
    .select("id, codigo, nombre, categoria, unidad_base")
    .eq("activo", true)
    .order("nombre");

  const { data: precios } = await supabase
    .from("precios_insumos")
    .select("material_id, periodo, precio_unitario, proveedor")
    .eq("version_id", id);

  // Construir un precio referencial: el más reciente por material (proveedor null prefiere a no-null)
  const precioRef = new Map<string, number>();
  const periodoRef = new Map<string, string>();
  for (const p of (precios ?? []) as Array<{ material_id: string; periodo: string; precio_unitario: number; proveedor: string | null }>) {
    const cur = periodoRef.get(p.material_id);
    if (!cur || p.periodo > cur) {
      periodoRef.set(p.material_id, p.periodo);
      precioRef.set(p.material_id, Number(p.precio_unitario));
    }
  }

  // Sólo materiales con al menos un precio (los demás no aportan a sensibilidad)
  const matsConPrecio = (materiales ?? [])
    .filter(m => precioRef.has(m.id))
    .map(m => ({
      id:       m.id,
      codigo:   m.codigo,
      nombre:   m.nombre,
      categoria: m.categoria ?? "—",
      unidad:   m.unidad_base,
      precio:   precioRef.get(m.id) ?? 0,
    }));

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Sensibilidad</span>
      </nav>

      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Análisis de Sensibilidad</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Aplica variaciones (%) a precios de insumos y observa el impacto en los costos por proceso.
          La ejecución es efímera — no modifica la versión base.
        </p>
      </div>

      {matsConPrecio.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm">Carga precios para esta versión para poder analizar sensibilidad.</p>
        </div>
      ) : (
        <SensibilidadForm versionId={id} materiales={matsConPrecio} />
      )}
    </div>
  );
}
