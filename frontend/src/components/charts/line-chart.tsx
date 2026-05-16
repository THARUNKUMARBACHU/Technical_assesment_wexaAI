"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import type { LineChartData } from "@/types/api";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6"];

interface LineChartWidgetProps {
  data: LineChartData;
}

function formatLabel(label: string): string {
  if (label.includes("T") || label.includes("-")) {
    const d = new Date(label);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }
  return label.length > 10 ? label.slice(0, 8) + "..." : label;
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function LineChartWidget({ data }: LineChartWidgetProps) {
  const chartData = data.labels.map((label, index) => {
    const point: Record<string, string | number> = { name: label };
    data.datasets.forEach((dataset) => {
      point[dataset.label] = dataset.values[index] ?? 0;
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--muted-foreground))"
          tickFormatter={formatLabel}
          tickLine={false}
          axisLine={false}
          dy={4}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--muted-foreground))"
          tickFormatter={formatYAxis}
          tickLine={false}
          axisLine={false}
          width={45}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(var(--popover-foreground))",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          formatter={(value) => [Number(value).toLocaleString(), ""]}
        />
        {data.datasets.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
            iconSize={8}
          />
        )}
        {data.datasets.map((dataset, index) => (
          <Line
            key={dataset.label}
            type="monotone"
            dataKey={dataset.label}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={chartData.length <= 20 ? { r: 2.5 } : false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
