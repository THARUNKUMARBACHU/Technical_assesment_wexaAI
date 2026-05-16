"use client";

import { useWidgetData } from "@/hooks/use-dashboards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChartWidget } from "@/components/charts/line-chart";
import { BarChartWidget } from "@/components/charts/bar-chart";
import { PieChartWidget } from "@/components/charts/pie-chart";
import { KpiCardWidget } from "@/components/charts/kpi-card";
import { DataTableWidget } from "@/components/charts/data-table-widget";
import { AlertCircleIcon } from "lucide-react";
import type {
  Widget,
  LineChartData,
  BarChartData,
  PieChartData,
  KpiData,
  TableData,
} from "@/types/api";

interface WidgetRendererProps {
  widget: Widget;
  dashboardId: string;
  timeRange?: string;
}

export function WidgetRenderer({
  widget,
  dashboardId,
  timeRange,
}: WidgetRendererProps) {
  const { data, isLoading, isError, error } = useWidgetData(
    dashboardId,
    widget.id,
    timeRange
  );

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="border-b pb-2">
        <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3">
        {isLoading ? (
          <WidgetSkeleton widgetType={widget.widget_type} />
        ) : isError ? (
          <WidgetError message={(error as Error)?.message ?? "Failed to load widget data"} />
        ) : data ? (
          <WidgetChart widgetType={widget.widget_type} data={data.data} />
        ) : (
          <WidgetEmpty />
        )}
      </CardContent>
    </Card>
  );
}

function WidgetChart({
  widgetType,
  data,
}: {
  widgetType: Widget["widget_type"];
  data: LineChartData | BarChartData | PieChartData | KpiData | TableData;
}) {
  switch (widgetType) {
    case "line":
      return <LineChartWidget data={data as LineChartData} />;
    case "bar":
      return <BarChartWidget data={data as BarChartData} />;
    case "pie":
      return <PieChartWidget data={data as PieChartData} />;
    case "kpi":
      return <KpiCardWidget data={data as KpiData} />;
    case "table":
      return <DataTableWidget data={data as TableData} />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Unsupported widget type: {widgetType}
        </div>
      );
  }
}

function WidgetSkeleton({ widgetType }: { widgetType: Widget["widget_type"] }) {
  if (widgetType === "kpi") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }

  if (widgetType === "table") {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full items-end gap-1 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  );
}

function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <AlertCircleIcon className="size-8 text-destructive" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function WidgetEmpty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No data available
    </div>
  );
}
