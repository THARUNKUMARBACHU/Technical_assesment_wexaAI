import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  AlertRule,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  MuteAlertRequest,
  ToggleAlertRequest,
  AlertEvent,
  AlertEventsQueryParams,
  PaginatedResponse,
} from "@/types/api";

// ---- Alert rules ----

export function useAlertRules(status?: string) {
  return useQuery({
    queryKey: queryKeys.alerts.rules(status),
    queryFn: () =>
      api.get<AlertRule[]>("/alerts/rules", { status }),
  });
}

export function useAlertRule(ruleId: string) {
  return useQuery({
    queryKey: queryKeys.alerts.ruleDetail(ruleId),
    queryFn: () => api.get<AlertRule>(`/alerts/rules/${ruleId}`),
    enabled: !!ruleId,
  });
}

export function useCreateAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAlertRuleRequest) =>
      api.post<AlertRule>("/alerts/rules", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });
}

export function useUpdateAlertRule(ruleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAlertRuleRequest) =>
      api.patch<AlertRule>(`/alerts/rules/${ruleId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      api.delete(`/alerts/rules/${ruleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });
}

export function useMuteAlertRule(ruleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MuteAlertRequest) =>
      api.post(`/alerts/rules/${ruleId}/mute`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });
}

export function useUnmuteAlertRule(ruleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/alerts/rules/${ruleId}/unmute`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });
}

export function useToggleAlertRule(ruleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ToggleAlertRequest) =>
      api.patch(`/alerts/rules/${ruleId}/toggle`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });
}

// ---- Alert events (history) ----

export function useAlertEvents(params?: AlertEventsQueryParams) {
  return useQuery({
    queryKey: queryKeys.alerts.events(params as Record<string, unknown>),
    queryFn: () =>
      api.get<PaginatedResponse<AlertEvent>>("/alerts/events", params as Record<string, string | number | undefined>),
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api.patch(`/alerts/events/${eventId}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "events"] });
    },
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api.patch(`/alerts/events/${eventId}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", "events"] });
    },
  });
}
