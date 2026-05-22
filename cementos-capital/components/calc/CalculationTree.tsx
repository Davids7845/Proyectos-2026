"use client";

import { useEffect, useState } from "react";

interface CalcNode {
  id: string;
  calculo_tipo: string;
  concepto: string;
  valor_resultado: number;
  unidad: string | null;
  formula_codigo: string;
  formula_nombre: string;
  formula_expresion: string;
  parametros_entrada: unknown;
  nivel_jerarquia: number;
  hijos: Array<{ rol: string | null; nodo: CalcNode }>;
  es_override: boolean;
  motivo_override: string | null;
  valor_original: number | null;
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 }).format(n);
}

function NodeView({ node, rol, depth }: { node: CalcNode; rol?: string | null; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.hijos.length > 0;

  return (
    <div className="text-sm">
      <div
        className={`flex items-start gap-2 py-1.5 ${depth > 0 ? "pl-3 border-l border-gray-200" : ""}`}
        style={{ marginLeft: depth > 0 ? 8 : 0 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-gray-400 hover:text-gray-700 w-4 text-center select-none"
            aria-label={open ? "Colapsar" : "Expandir"}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="text-gray-300 w-4 text-center">·</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {rol && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {rol}
              </span>
            )}
            <span className="font-medium text-gray-900">{node.concepto}</span>
            <span className="tabular-nums text-gray-700">{formatCOP(node.valor_resultado)}</span>
            {node.unidad && <span className="text-xs text-gray-400">{node.unidad}</span>}
            {node.es_override && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                OVERRIDE
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            <span className="font-mono text-[11px]">{node.formula_codigo}</span>
            {" · "}
            <span>{node.formula_nombre}</span>
          </div>
          {open && (
            <details className="mt-1 text-xs text-gray-600">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">expresión evaluada</summary>
              <div className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded font-mono text-[11px] whitespace-pre-wrap break-all">
                {node.formula_expresion}
              </div>
              {node.es_override && node.motivo_override && (
                <div className="mt-1 text-amber-700">
                  <strong>Override:</strong> {node.motivo_override}
                  {node.valor_original != null && (
                    <span className="ml-2 text-gray-500">(original: {formatCOP(node.valor_original)})</span>
                  )}
                </div>
              )}
            </details>
          )}
        </div>
      </div>
      {open && hasChildren && (
        <div className="mt-0.5">
          {node.hijos.map((c, i) => (
            <NodeView key={c.nodo.id + i} node={c.nodo} rol={c.rol} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CalculationTree({ calcId }: { calcId: string }) {
  const [root, setRoot] = useState<CalcNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/calculos/${calcId}/tree`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        if (alive) setRoot(j.root);
      })
      .catch(e => alive && setError(e?.message ?? String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [calcId]);

  if (loading) return <div className="text-sm text-gray-500">Cargando árbol…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!root) return <div className="text-sm text-gray-500">Sin datos.</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <NodeView node={root} depth={0} />
    </div>
  );
}
