"use client";

import { use, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Dashboard } from "@/types/api";
import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import { Skeleton } from "@/components/ui/skeleton";

export default function SharedDashboardPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = use(params);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<Dashboard>(`/shared/${shareToken}`, { skipAuth: true })
      .then(setDashboard)
      .catch(() => setError("Dashboard not found or link has expired."))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Shared Dashboard</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-muted-foreground">Shared view</span>
        </div>
        <h1 className="text-2xl font-bold">{dashboard.title}</h1>
        {dashboard.description && (
          <p className="text-muted-foreground mt-1">{dashboard.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboard.widgets.map((widget) => (
          <div
            key={widget.id}
            style={{
              minHeight: widget.widget_type === "kpi" ? "180px" : "320px",
            }}
          >
            <WidgetRenderer
              widget={widget}
              dashboardId={dashboard.id}
              shareToken={shareToken}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground">
        Powered by LoopBoard
      </div>
    </div>
  );
}
