"use client";

import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiData } from "@/types/api";

interface KpiCardWidgetProps {
  data: KpiData;
}

export function KpiCardWidget({ data }: KpiCardWidgetProps) {
  const isPositive = data.change_direction === "up";
  const isNegative = data.change_direction === "down";
  const isFlat = data.change_direction === "flat";

  const formattedValue =
    typeof data.current_value === "number"
      ? data.current_value.toLocaleString()
      : data.current_value;

  const formattedPrevious =
    typeof data.previous_value === "number"
      ? data.previous_value.toLocaleString()
      : data.previous_value;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
      <div className="text-4xl font-bold tracking-tight">{formattedValue}</div>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-sm font-medium",
            isPositive && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
            isNegative && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            isFlat && "bg-muted text-muted-foreground"
          )}
        >
          {isPositive && <ArrowUpIcon className="size-3.5" />}
          {isNegative && <ArrowDownIcon className="size-3.5" />}
          {isFlat && <MinusIcon className="size-3.5" />}
          {Math.abs(data.change_percent).toFixed(1)}%
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        Previous: {formattedPrevious}
      </div>
    </div>
  );
}
