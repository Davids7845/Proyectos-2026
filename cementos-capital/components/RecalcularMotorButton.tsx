"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu } from "lucide-react";
import { BRAND } from "@/lib/ui/colors";

/**
 * Botón TEMPORAL de R6a — dispara el motor de fórmulas nuevo y persiste en
 * costo_calculado. Permite comparar contra el motor viejo con `?motor=nuevo`.
 * Se elimina en R6c.
 */
export default function RecalcularMotorButton({ versionId }: { versionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/versiones/${versionId}/recalcular-motor`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
      setOk(`${body.periodos_calculados} períodos calculados`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al recalcular");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={loading}
        title="Motor de fórmulas nuevo (temporal R6a) — persiste en costo_calculado"
        className="inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border"
        style={{ borderColor: BRAND.primary, color: BRAND.primary }}
      >
        <Cpu size={14} />
        {loading ? "Calculando…" : "Recalcular motor nuevo"}
      </button>
      {ok && <span className="text-xs mt-1" style={{ color: BRAND.success }}>{ok}</span>}
      {error && <span className="text-xs text-red-600 mt-1">{error}</span>}
    </span>
  );
}
