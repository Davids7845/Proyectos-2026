import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import VentasTable from "@/components/datos/VentasTable";

export default async function VentasPage({
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

  const { data: ventas } = await supabase
    .from("ventas_proyectadas")
    .select("id, material_id, presentacion, periodo, cantidad_ton, precio_venta")
    .eq("version_id", id)
    .order("periodo");

  const { data: materiales } = await supabase
    .from("materiales")
    .select("id, codigo, nombre")
    .order("nombre");

  const periodos = Array.from(new Set((ventas ?? []).map(v => v.periodo))).sort();

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Datos / Ventas</span>
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Ventas proyectadas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {(ventas ?? []).length} registros · {periodos.length} periodos · estado <strong>{version.estado}</strong>
        </p>
      </div>

      <VentasTable
        ventas={(ventas ?? []).map(v => ({
          ...v,
          cantidad_ton: Number(v.cantidad_ton),
          precio_venta: v.precio_venta != null ? Number(v.precio_venta) : null,
        }))}
        materiales={materiales ?? []}
        periodos={periodos}
      />
    </div>
  );
}
