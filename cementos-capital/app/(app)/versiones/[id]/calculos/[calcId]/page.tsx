import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import CalculationTree from "@/components/calc/CalculationTree";

export default async function CalculoPage({
  params,
}: {
  params: Promise<{ id: string; calcId: string }>;
}) {
  const { id: versionId, calcId } = await params;
  const supabase = await createClient();

  const [{ data: version }, { data: calc }] = await Promise.all([
    supabase.from("budget_versions").select("id, nombre").eq("id", versionId).single(),
    supabase
      .from("calculation_log")
      .select(`
        id, calculo_tipo, concepto, periodo, valor_resultado, unidad,
        proceso:procesos(nombre, ord)
      `)
      .eq("id", calcId)
      .single(),
  ]);
  if (!version || !calc) notFound();
  const proceso = Array.isArray(calc.proceso) ? calc.proceso[0] : calc.proceso;

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${versionId}/calcular`} className="hover:underline">{version.nombre}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Árbol de cálculo</span>
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{calc.concepto}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {proceso?.nombre && <>ORD {proceso.ord} · {proceso.nombre} · </>}
          Periodo {calc.periodo} · Resultado{" "}
          <strong className="tabular-nums">
            {Number(calc.valor_resultado).toLocaleString("es-CO", { maximumFractionDigits: 4 })}
          </strong>
          {calc.unidad && ` ${calc.unidad}`}
        </p>
      </div>

      <CalculationTree calcId={calcId} />
    </div>
  );
}
