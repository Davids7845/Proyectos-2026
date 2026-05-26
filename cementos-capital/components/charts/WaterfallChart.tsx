"use client";

import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

export interface WaterfallItem {
  label: string;
  value: number;   // delta (positivo = sube, negativo = baja)
  base: number;    // valor base de la versión A
  comp: number;    // valor en la versión B (solo para totales)
  isTotal?: boolean;
}

interface WaterfallChartProps {
  items: WaterfallItem[];
  title: string;
  unidad?: string;
}

interface ChartPoint {
  label: string;
  invisible: number;
  positive: number;
  negative: number;
  isTotal: boolean;
  tooltip: string;
}

function buildWaterfallData(items: WaterfallItem[]): ChartPoint[] {
  const points: ChartPoint[] = [];
  let cumulative = 0;

  for (const item of items) {
    if (item.isTotal) {
      points.push({
        label: item.label,
        invisible: 0,
        positive: item.comp > 0 ? item.comp : 0,
        negative: item.comp < 0 ? Math.abs(item.comp) : 0,
        isTotal: true,
        tooltip: fmtNum(item.comp),
      });
      continue;
    }
    const start = cumulative;
    const end   = cumulative + item.value;
    const lo    = Math.min(start, end);
    const hi    = Math.max(start, end);

    points.push({
      label: item.label,
      invisible: lo,
      positive:  item.value >= 0 ? item.value : 0,
      negative:  item.value <  0 ? Math.abs(item.value) : 0,
      isTotal: false,
      tooltip: (item.value >= 0 ? "+" : "") + fmtNum(item.value),
    });
    cumulative = end;
    void hi; void lo;
  }
  return points;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload.find((d: any) => d.dataKey !== "invisible" && d.value !== 0);
  if (!p) return null;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      <p className={p.dataKey === "positive" ? "text-red-600" : "text-green-600"}>
        {p.payload.tooltip}
      </p>
    </div>
  );
};

function fmtNum(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export default function WaterfallChart({ items, title, unidad = "COP/Ton" }: WaterfallChartProps) {
  const data = buildWaterfallData(items);
  if (data.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{unidad} — barras rojas suben el costo, verdes lo bajan</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          {/* Barra invisible que desplaza las barras visibles al nivel correcto */}
          <Bar dataKey="invisible" stackId="wf" fill="transparent" />
          {/* Incrementos positivos (costo sube → rojo) */}
          <Bar dataKey="positive" stackId="wf" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.isTotal ? "#6b7280" : "#ef4444"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
          {/* Decrementos negativos (costo baja → verde) */}
          <Bar dataKey="negative" stackId="wf2" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isTotal ? "#6b7280" : "#22c55e"} fillOpacity={0.85} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
