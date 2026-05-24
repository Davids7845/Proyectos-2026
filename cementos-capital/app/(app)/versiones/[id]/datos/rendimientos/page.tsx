import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import RendimientosTable from "@/components/datos/RendimientosTable";

export default async function RendimientosPage({
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

  const { data: rendimientos } = await supabase
    .from("rendimientos")
    .select("id, proceso_id, periodo, horas_mes, produccion_ton, horas_operacion_efectivas, rendimiento_ton_hr, disponibilidad, utilizacion, oee")
    .eq("version_id", id)
    .order("periodo");

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre, material")
    .eq("activo", true)
    .order("ord");

  const periodos = Array.from(new Set((rendimientos ?? []).map(r => r.periodo))).sort();

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Datos / Rendimientos</span>
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Rendimientos por proceso</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {(rendimientos ?? []).length} registros · {periodos.length} periodos · estado <strong>{version.estado}</strong>
        </p>
      </div>

      <RendimientosTable
        rendimientos={(rendimientos ?? []).map(r => ({
          ...r,
          horas_mes: r.horas_mes ?? null,
          produccion_ton: r.produccion_ton != null ? Number(r.produccion_ton) : null,
          horas_operacion_efectivas: r.horas_operacion_efectivas != null ? Number(r.horas_operacion_efectivas) : null,
          rendimiento_ton_hr: r.rendimiento_ton_hr != null ? Number(r.rendimiento_ton_hr) : null,
          disponibilidad: r.disponibilidad != null ? Number(r.disponibilidad) : null,
          utilizacion: r.utilizacion != null ? Number(r.utilizacion) : null,
          oee: r.oee != null ? Number(r.oee) : null,
        }))}
        procesos={procesos ?? []}
        periodos={periodos}
      />
    </div>
  );
}
