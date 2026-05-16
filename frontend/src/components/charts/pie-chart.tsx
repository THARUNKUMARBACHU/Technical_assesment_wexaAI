"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import type { PieChartData } from "@/types/api";

const COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4",
];

interface PieChartWidgetProps {
  data: PieChartData;
}

export function PieChartWidget({ data }: PieChartWidgetProps) {
  // Deduplicate: merge entries with the same label
  const merged = new Map<string, number>();
  data.labels.forEach((label, index) => {
    const val = data.values[index] ?? 0;
    merged.set(label, (merged.get(label) ?? 0) + val);
  });

  const chartData = Array.from(merged, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Limit to top 10 slices

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius="35%"
          outerRadius="60%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }: { name?: string; percent?: number }) => {
            const pct = ((percent ?? 0) * 100).toFixed(0);
            const shortName = (name ?? "").length > 12
              ? (name ?? "").slice(0, 10) + "..."
              : (name ?? "");
            return `${shortName} ${pct}%`;
          }}
          labelLine={false}
          fontSize={11}
          fill="hsl(var(--foreground))"
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(var(--popover-foreground))",
          }}
          formatter={(value: number) => [
            `${value.toLocaleString()} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
            "",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", overflow: "hidden", maxHeight: "40px", color: "hsl(var(--foreground))" }}
          iconSize={8}
          formatter={(value: string) =>
            value.length > 15 ? value.slice(0, 13) + "..." : value
          }
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
