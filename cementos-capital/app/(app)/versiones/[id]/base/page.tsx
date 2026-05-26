// Vista "Base" — réplica navegable de la hoja Base del Excel SAP.
// Muestra todos los movimientos contables del último run.

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import BaseFilters from "./BaseFilters";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; tipo?: string; periodo?: string; ord?: string }>;
}

export default async function BasePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const page   = Math.max(1, Number(sp.page ?? "1"));
  const tipo   = sp.tipo ?? "";
  const periodo = sp.periodo ?? "";
  const ord    = sp.ord ?? "";

  const supabase = await createClient();

  const { data: version } = await supabase
    .from("budget_versions")
    .select("id, nombre, sap_enabled")
    .eq("id", id)
    .single();
  if (!version) notFound();

  // Periodos disponibles para el filtro
  const { data: periodosRaw } = await supabase
    .from("movimientos_contables")
    .select("periodo")
    .eq("version_id", id);
  const periodosSet = Array.from(new Set((periodosRaw ?? []).map(r => r.periodo as string)));
  const periodos = periodosSet.sort();

  // Procesos para filtro de ORD
  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, ord, nombre")
    .order("ord");

  const LIMIT = 100;
  const offset = (page - 1) * LIMIT;

  let query = supabase
    .from("v_movimientos_base")
    .select("*", { count: "exact" })
    .eq("version_id", id)
    .order("periodo")
    .order("ord")
    .range(offset, offset + LIMIT - 1);

  if (tipo)    query = query.eq("tipo_movimiento", tipo);
  if (periodo) query = query.eq("periodo", periodo);
  if (ord)     query = query.eq("ord", Number(ord));

  const { data: movimientos, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  function buildUrl(overrides: Record<string, string>) {
    const urlParams: Record<string, string> = { page: String(page), tipo, periodo, ord, ...overrides };
    const filtered = Object.entries(urlParams).filter(([, v]) => v && v !== "0");
    const qs = new URLSearchParams(filtered).toString();
    return `/versiones/${id}/base${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <nav className="text-xs text-gray-500 mb-2">
        <Link href="/versiones" className="hover:underline">Versiones</Link>
        <span className="mx-1">/</span>
        <Link href={`/versiones/${id}`} className="hover:underline">{version.nombre}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Base SAP</span>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Movimientos contables — Base SAP</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString("es-CO")} movimientos totales</p>
        </div>
        {!version.sap_enabled && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
            SAP deshabilitado — actívalo para generar movimientos al calcular
          </p>
        )}
      </div>

      {/* Filtros (Client Component para manejar onChange) */}
      <BaseFilters
        versionId={id}
        periodos={periodos}
        procesos={(procesos ?? []).map(p => ({ id: p.id, ord: p.ord, nombre: p.nombre }))}
        currentTipo={tipo}
        currentPeriodo={periodo}
        currentOrd={ord}
      />

      {(movimientos ?? []).length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center mt-4">
          <p className="text-gray-500 text-sm">
            {version.sap_enabled
              ? "No hay movimientos para esta versión. Ejecuta un cálculo para generarlos."
              : "Esta versión no tiene SAP habilitado."}
          </p>
          <Link href={`/versiones/${id}/calcular`} className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            Ir a calcular →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-4">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Período</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Clase costo</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Denominación</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Valor (COP)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap">Cantidad</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Ud</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Centro</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Material</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Orden SAP</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">ORD</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Proceso</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Tipo insumo</th>
                </tr>
              </thead>
              <tbody>
                {(movimientos ?? []).map((m: any) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtPeriodo(m.periodo)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        m.tipo_movimiento === "entrada" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {m.tipo_movimiento}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 tabular-nums font-mono whitespace-nowrap">{m.clase_costo_codigo ?? "—"}</td>
                    <td className="px-3 py-1.5 max-w-[16rem] truncate" title={m.clase_costo_denom ?? ""}>{m.clase_costo_denom ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                      {m.valor_monetario != null
                        ? Number(m.valor_monetario).toLocaleString("es-CO", { maximumFractionDigits: 0 })
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                      {m.cantidad != null
                        ? Number(m.cantidad).toLocaleString("es-CO", { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-3 py-1.5">{m.unidad ?? "—"}</td>
                    <td className="px-3 py-1.5">{m.centro_costo ?? "—"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {m.calc_id ? (
                        <Link
                          href={`/versiones/${id}/calculos/${m.calc_id}`}
                          className="text-blue-600 hover:underline"
                          title={m.material_nombre ?? ""}
                        >
                          {m.material_codigo ?? "—"}
                        </Link>
                      ) : (m.material_codigo ?? "—")}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums font-mono">{m.orden_sap ?? "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{m.ord ?? "—"}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap max-w-[12rem] truncate" title={m.proceso_nombre ?? ""}>
                      {m.proceso_nombre ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{m.tipo_insumo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Mostrando {offset + 1}–{Math.min(offset + LIMIT, total)} de {total.toLocaleString("es-CO")}
            </p>
            <div className="flex gap-1">
              {page > 1 && (
                <Link href={buildUrl({ page: String(page - 1) })}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildUrl({ page: String(page + 1) })}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtPeriodo(p: string | null) {
  if (!p) return "—";
  return new Date(p + "T00:00:00Z").toLocaleDateString("es-CO", {
    month: "short", year: "2-digit", timeZone: "UTC",
  });
}
