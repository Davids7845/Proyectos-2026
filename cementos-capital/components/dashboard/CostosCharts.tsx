"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import { BRAND } from "@/lib/ui/colors";

interface BarDatum {
  nombre: string;
  costo: number;
}

interface LineDatum {
  periodo: string;
  ug?: number;
  art?: number;
}

interface Props {
  barData: BarDatum[];
  lineData: LineDatum[];
}

function fmtCop(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function fmtPeriodo(p: string) {
  const d = new Date(p + "T00:00:00");
  return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmtCop(p.value)} COP/Ton
        </p>
      ))}
    </div>
  );
};

export default function CostosCharts({ barData, lineData }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Barras: costo/Ton último periodo ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Costo/Ton por proceso — último periodo</h2>
        {barData.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Sin datos de costo.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtCop}
                tick={{ fontSize: 11 }}
                width={70}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                width={160}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="costo" name="COP/Ton" fill={BRAND.primary} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Línea: evolución mensual CEM UG y ART ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Evolución mensual — Cemento UG y ART (granel)</h2>
        {lineData.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Sin datos de evolución.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData} margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="periodo"
                tickFormatter={fmtPeriodo}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={fmtCop}
                tick={{ fontSize: 11 }}
                width={72}
              />
              <Tooltip
                content={<CustomTooltip />}
                labelFormatter={(label: any) => typeof label === "string" ? fmtPeriodo(label) : label}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="ug"
                name="Cemento UG"
                stroke={BRAND.productos.ug}
                dot={{ r: 3 }}
                strokeWidth={2}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="art"
                name="Cemento ART"
                stroke={BRAND.productos.art}
                dot={{ r: 3 }}
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
