import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import EnergiaTable from "@/components/datos/EnergiaTable";

export default async function EnergiaPage({
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

  const { data: parametros } = await supabase
    .from("parametros_energia")
    .select("id, periodo, precio_contrato, precio_restricciones, cargos_fijos, kwh_ton_proceso, pci_combustibles, kcal_tck_total, pci_ponderado_horno")
    .eq("version_id", id)
    .order("periodo");

  const periodos = Array.from(new Set((parametros ?? []).map(p => p.periodo))).sort();

  const rows = (parametros ?? []).map(p => ({
    id: p.id,
    periodo: p.periodo,
    precio_contrato:      p.precio_contrato      != null ? Number(p.precio_contrato)      : null,
    precio_restricciones: p.precio_restricciones != null ? Number(p.precio_restricciones) : null,
    cargos_fijos:         p.cargos_fijos         != null ? Number(p.cargos_fijos)         : null,
    kwh_ton_proceso:      (p.kwh_ton_proceso as Record<string, number> | null) ?? null,
    pci_combustibles:     (p.pci_combustibles as Record<string, number> | null) ?? null,
    kcal_tck_total:       p.kcal_tck_total       != null ? Number(p.kcal_tck_total)       : null,
    pci_ponderado_horno:  p.pci_ponderado_horno  != null ? Number(p.pci_ponderado_horno)  : null,
  }));

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <span>{version.nombre}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Datos / Energía</span>
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Parámetros de Energía</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {rows.length} periodos cargados · estado <strong>{version.estado}</strong>
        </p>
      </div>

      <EnergiaTable parametros={rows} periodos={periodos} />
    </div>
  );
}
