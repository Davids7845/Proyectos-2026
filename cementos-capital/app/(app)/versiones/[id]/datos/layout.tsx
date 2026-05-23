// Sub-navegación compartida para la sección /datos de una versión.

import Link from "next/link";

export default async function DatosLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tabs = [
    { href: `/versiones/${id}/datos/precios`,   label: "Precios" },
    { href: `/versiones/${id}/datos/recetas`,   label: "Recetas" },
    { href: `/versiones/${id}/datos/importar`,  label: "Importar Excel" },
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
