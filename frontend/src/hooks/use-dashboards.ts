import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  CreateDashboardRequest,
  Dashboard,
  DashboardSummary,
  UpdateDashboardRequest,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  LayoutUpdateRequest,
  Widget,
  WidgetDataResponse,
  CreateShareRequest,
  DashboardShare,
} from "@/types/api";

// ---- Dashboard list ----

export function useDashboards(filter?: string) {
  return useQuery({
    queryKey: queryKeys.dashboards.list(filter),
    queryFn: () =>
      api.get<DashboardSummary[]>("/dashboards", { filter }),
  });
}

// ---- Single dashboard with widgets ----

export function useDashboard(dashboardId: string) {
  return useQuery({
    queryKey: queryKeys.dashboards.detail(dashboardId),
    queryFn: () => api.get<Dashboard>(`/dashboards/${dashboardId}`),
    enabled: !!dashboardId,
  });
}

// ---- Dashboard mutations ----

export function useCreateDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDashboardRequest) =>
      api.post<Dashboard>("/dashboards", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards", "list"] });
    },
  });
}

export function useUpdateDashboard(dashboardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDashboardRequest) =>
      api.patch<Dashboard>(`/dashboards/${dashboardId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards.detail(dashboardId) });
      qc.invalidateQueries({ queryKey: ["dashboards", "list"] });
    },
  });
}

export function useDeleteDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dashboardId: string) =>
      api.delete(`/dashboards/${dashboardId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards", "list"] });
    },
  });
}

export function useDuplicateDashboard(dashboardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Dashboard>(`/dashboards/${dashboardId}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards", "list"] });
    },
  });
}

// ---- Widget CRUD ----

export function useCreateWidget(dashboardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWidgetRequest) =>
      api.post<Widget>(`/dashboards/${dashboardId}/widgets`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards.detail(dashboardId) });
    },
  });
}

export function useUpdateWidget(dashboardId: string, widgetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateWidgetRequest) =>
      api.patch<Widget>(`/dashboards/${dashboardId}/widgets/${widgetId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards.detail(dashboardId) });
    },
  });
}

export function useDeleteWidget(dashboardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgetId: string) =>
      api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards.detail(dashboardId) });
    },
  });
}

export function useUpdateLayout(dashboardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LayoutUpdateRequest) =>
      api.patch(`/dashboards/${dashboardId}/layout`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dashboards.detail(dashboardId) });
    },
  });
}

// ---- Widget data (each widget fetches independently) ----

export function useWidgetData(
  dashboardId: string,
  widgetId: string,
  timeRange?: string
) {
  return useQuery({
    queryKey: queryKeys.widgets.data(dashboardId, widgetId, timeRange),
    queryFn: () =>
      api.get<WidgetDataResponse>(
        `/dashboards/${dashboardId}/widgets/${widgetId}/data`,
        { time_range: timeRange }
      ),
    enabled: !!dashboardId && !!widgetId,
    refetchInterval: undefined, // controlled by auto-refresh at dashboard level
  });
}

// ---- Dashboard sharing ----

export function useShareDashboard(dashboardId: string) {
  return useMutation({
    mutationFn: (data: CreateShareRequest) =>
      api.post<DashboardShare>(`/dashboards/${dashboardId}/share`, data),
  });
}
