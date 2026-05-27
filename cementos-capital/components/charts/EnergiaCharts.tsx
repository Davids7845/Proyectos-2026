"use client";

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import { BRAND, formatMes, formatCOP } from "@/lib/ui/colors";
import DonutChart from "./DonutChart";

interface LineDatum {
  periodo: string;
  contrato: number | null;
  restricciones: number | null;
  cargos: number | null;
}

interface BarDatum {
  proceso: string;
  [periodo: string]: string | number;
}

interface DonutDatum {
  name: string;
  value: number;
}

export function PreciosLineChart({ data }: { data: LineDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ left: 8, right: 24, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BRAND.border} />
        <XAxis dataKey="periodo" tickFormatter={(v) => formatMes(v)} tick={{ fontSize: 11, fill: BRAND.inkSecondary }} />
        <YAxis tick={{ fontSize: 11, fill: BRAND.inkSecondary }} width={70} />
        <Tooltip
          contentStyle={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => formatMes(v as string)}
          formatter={((value: unknown) => formatCOP(Number(value ?? 0))) as any}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="contrato" name="Precio Contrato" stroke={BRAND.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="restricciones" name="Restricciones" stroke={BRAND.accent} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="cargos" name="Cargos Fijos" stroke={BRAND.inkSecondary} strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ConsumoBarChart({ data, periodos }: { data: BarDatum[]; periodos: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 36 + 80)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={BRAND.border} />
        <XAxis type="number" tick={{ fontSize: 11, fill: BRAND.inkSecondary }} />
        <YAxis type="category" dataKey="proceso" tick={{ fontSize: 11, fill: BRAND.inkSecondary }} width={140} />
        <Tooltip
          contentStyle={{ background: BRAND.bgCard, border: `1px solid ${BRAND.border}`, borderRadius: 8, fontSize: 12 }}
          formatter={((value: unknown) => `${Number(value ?? 0).toFixed(1)} kWh/Ton`) as any}
          labelFormatter={(v) => v}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {periodos.map((p, i) => (
          <Bar key={p} dataKey={p} name={formatMes(p)} fill={BRAND.chart[i % BRAND.chart.length]} radius={[0, 2, 2, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MixDonut({ data }: { data: DonutDatum[] }) {
  return <DonutChart data={data} height={260} unit="kcal" />;
}
