import { FORMULA_REGISTRY } from "@/lib/calc/formulas";

export default function FormulasAdminPage() {
  const formulas = Object.values(FORMULA_REGISTRY);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Fórmulas de cálculo</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {formulas.length} fórmulas registradas · solo lectura
        </p>
      </div>

      <div className="space-y-3">
        {formulas.map((f) => (
          <div key={f.codigo} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {f.codigo}
                  </code>
                  <span className="text-xs text-gray-400">{f.retorno_unidad}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{f.nombre}</p>
                <p className="text-xs font-mono text-blue-700 mt-1 break-all">{f.expresion}</p>
              </div>
            </div>

            {f.parametros.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">Parámetros</p>
                <div className="space-y-1">
                  {f.parametros.map((p) => (
                    <div key={p.nombre} className="flex items-center gap-2 text-xs">
                      <code className="font-mono text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded">
                        {p.nombre}
                      </code>
                      <span className="text-gray-400">{p.tipo}</span>
                      {p.unidad && (
                        <span className="text-gray-400">· {p.unidad}</span>
                      )}
                      {p.descripcion && (
                        <span className="text-gray-500">{p.descripcion}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
