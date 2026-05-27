"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { BRAND } from "@/lib/ui/colors";

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
    <header style={{ backgroundColor: BRAND.primaryDark }} className="shadow-md">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-white text-sm tracking-wide">
            Cementos Alión — Presupuesto
          </span>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith(link.match)
                    ? "bg-white/20 text-white"
                    : "text-blue-200 hover:text-white hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-200">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-blue-200 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
