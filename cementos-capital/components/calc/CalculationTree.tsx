"use client";

import { useEffect, useState, useCallback } from "react";

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

interface NodeViewProps {
  node: CalcNode;
  rol?: string | null;
  depth: number;
  onOverride: (node: CalcNode) => void;
  onRestore: (node: CalcNode) => void;
  pendingId: string | null;
}

function NodeView({ node, rol, depth, onOverride, onRestore, pendingId }: NodeViewProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.hijos.length > 0;
  const pending = pendingId === node.id;

  return (
    <div className="text-sm">
      <div
        className={`flex items-start gap-2 py-1.5 ${depth > 0 ? "pl-3 border-l border-gray-200" : ""} ${pending ? "opacity-60" : ""}`}
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
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => onOverride(node)}
                disabled={pending}
                className="text-[11px] text-blue-600 hover:underline disabled:opacity-50"
              >
                editar
              </button>
              {node.es_override && (
                <button
                  onClick={() => onRestore(node)}
                  disabled={pending}
                  className="text-[11px] text-amber-700 hover:underline disabled:opacity-50"
                >
                  restaurar
                </button>
              )}
            </div>
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
            <NodeView
              key={c.nodo.id + i}
              node={c.nodo}
              rol={c.rol}
              depth={depth + 1}
              onOverride={onOverride}
              onRestore={onRestore}
              pendingId={pendingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal de override ─────────────────────────────────────────────

interface OverrideModalProps {
  node: CalcNode;
  onSubmit: (nuevo_valor: number, motivo: string) => Promise<void>;
  onCancel: () => void;
}

function OverrideModal({ node, onSubmit, onCancel }: OverrideModalProps) {
  const [valor, setValor] = useState(String(node.valor_resultado));
  const [motivo, setMotivo] = useState(node.motivo_override ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const n = Number(valor);
    if (!Number.isFinite(n)) { setError("El valor debe ser numérico"); return; }
    if (motivo.trim().length === 0) { setError("Indica un motivo del override"); return; }
    setSaving(true);
    setError(null);
    try { await onSubmit(n, motivo.trim()); }
    catch (e: any) { setError(e?.message ?? String(e)); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-gray-900">Override de cálculo</h2>
        <p className="text-xs text-gray-500 mt-0.5">{node.concepto}</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Valor actual</label>
            <div className="text-sm tabular-nums text-gray-500 px-2 py-1 bg-gray-50 rounded">
              {formatCOP(node.valor_resultado)} {node.unidad ?? ""}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nuevo valor</label>
            <input
              type="number"
              step="any"
              autoFocus
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="block w-full text-sm px-2 py-1.5 border border-gray-300 rounded tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej: ajuste por negociación con proveedor"
              className="block w-full text-sm px-2 py-1.5 border border-gray-300 rounded"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Aplicando…" : "Aplicar override"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────

export default function CalculationTree({ calcId }: { calcId: string }) {
  const [root, setRoot] = useState<CalcNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalNode, setModalNode] = useState<CalcNode | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/calculos/${calcId}/tree`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setRoot(j.root);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [calcId]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  async function handleOverrideSubmit(nuevo_valor: number, motivo: string) {
    if (!modalNode) return;
    setPendingId(modalNode.id);
    try {
      const r = await fetch(`/api/calculos/${modalNode.id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nuevo_valor, motivo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setBannerMsg(`Override aplicado · ${j.ancestros_recalculados} ancestros recalculados${j.warnings?.length ? ` · ${j.warnings.length} warnings` : ""}`);
      setModalNode(null);
      await fetchTree();
    } catch (e: any) {
      throw e;
    } finally {
      setPendingId(null);
    }
  }

  async function handleRestore(node: CalcNode) {
    if (!confirm(`Restaurar "${node.concepto}" a su valor original?`)) return;
    setPendingId(node.id);
    setBannerMsg(null);
    try {
      const r = await fetch(`/api/calculos/${node.id}/override`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setBannerMsg(`Override removido · ${j.ancestros_recalculados} ancestros recalculados`);
      await fetchTree();
    } catch (e: any) {
      setBannerMsg(`Error: ${e?.message ?? e}`);
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Cargando árbol…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!root) return <div className="text-sm text-gray-500">Sin datos.</div>;

  return (
    <>
      {bannerMsg && (
        <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-800 text-xs rounded flex items-center justify-between">
          <span>{bannerMsg}</span>
          <button onClick={() => setBannerMsg(null)} className="text-green-700 hover:underline">×</button>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <NodeView
          node={root}
          depth={0}
          onOverride={setModalNode}
          onRestore={handleRestore}
          pendingId={pendingId}
        />
      </div>
      {modalNode && (
        <OverrideModal
          node={modalNode}
          onSubmit={handleOverrideSubmit}
          onCancel={() => setModalNode(null)}
        />
      )}
    </>
  );
}
