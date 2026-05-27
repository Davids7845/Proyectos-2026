"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { BRAND, formatCOP } from "@/lib/ui/colors";

interface DonutDatum {
  name: string;
  value: number;
}

interface Props {
  data: DonutDatum[];
  height?: number;
  unit?: string;
  innerRadius?: number;
  outerRadius?: number;
}

export default function DonutChart({
  data,
  height = 280,
  unit = "COP",
  innerRadius = 60,
  outerRadius = 100,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          stroke={BRAND.bgCard}
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={BRAND.chart[i % BRAND.chart.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: BRAND.bgCard,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={((value: unknown, name: unknown) => {
            const v = Number(value ?? 0);
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
            return [`${unit === "COP" ? formatCOP(v) : v.toLocaleString("es-CO")} (${pct} %)`, String(name ?? "")];
          }) as any}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
