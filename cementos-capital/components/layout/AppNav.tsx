"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AppNavProps {
  user: User;
}

export default function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navLinks = [
    { href: "/versiones", label: "Versiones", match: "/versiones" },
    { href: "/admin/maestros/procesos", label: "Maestros", match: "/admin/maestros" },
    { href: "/admin/formulas", label: "Fórmulas", match: "/admin/formulas" },
  ];

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900 text-sm">
            Cementos Capital — Presupuesto
          </span>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith(link.match)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
