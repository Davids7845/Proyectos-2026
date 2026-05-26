// Sub-navegación compartida para la sección /datos de una versión.
import { createClient } from "@/lib/supabase/server";

export default async function DatosLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("budget_versions")
    .select("precios_fijos")
    .eq("id", id)
    .single();
  const preciosFijos = Boolean((version as { precios_fijos?: boolean } | null)?.precios_fijos);

  const tabs = [
    { href: `/versiones/${id}/datos/precios`,        label: "Precios" },
    ...(preciosFijos ? [{ href: `/versiones/${id}/datos/precios-fijos`, label: "Precios Fijos" }] : []),
    { href: `/versiones/${id}/datos/recetas`,        label: "Recetas" },
    { href: `/versiones/${id}/datos/rendimientos`,   label: "Rendimientos" },
    { href: `/versiones/${id}/datos/ventas`,         label: "Ventas" },
    { href: `/versiones/${id}/datos/energia`,        label: "Energía" },
    { href: `/versiones/${id}/datos/importar`,       label: "Importar Excel" },
  ];

  return (
    <div>
      <nav className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map(t => (
          <DatosTab key={t.href} href={t.href} label={t.label} />
        ))}
      </nav>
      {children}
    </div>
  );
}

// Client component mínimo solo para leer pathname
import DatosTab from "./DatosTab";
