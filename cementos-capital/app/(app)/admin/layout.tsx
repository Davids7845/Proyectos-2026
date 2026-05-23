import AdminTab from "./AdminTab";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { href: "/admin/maestros/procesos",   label: "Procesos" },
    { href: "/admin/maestros/materiales", label: "Materiales" },
    { href: "/admin/formulas",            label: "Fórmulas" },
  ];
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Administración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Maestros de datos y fórmulas de cálculo</p>
      </div>
      <nav className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map(t => <AdminTab key={t.href} href={t.href} label={t.label} />)}
      </nav>
      {children}
    </div>
  );
}
