import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  Event,
  EventStats,
  EventsQueryParams,
  PaginatedResponse,
  ApiKey,
  ApiKeyWithSecret,
  CreateApiKeyRequest,
  CsvUpload,
  CsvUploadResponse,
  CsvColumnMapping,
} from "@/types/api";

// ---- Events ----

export function useEvents(params?: EventsQueryParams) {
  return useQuery({
    queryKey: queryKeys.events.list(params as Record<string, unknown>),
    queryFn: () =>
      api.get<PaginatedResponse<Event>>("/events", params as Record<string, string | number | undefined>),
  });
}

export function useEventStats() {
  return useQuery({
    queryKey: queryKeys.events.stats(),
    queryFn: () => api.get<EventStats>("/events/stats"),
    refetchInterval: 60_000, // refresh every minute
  });
}

// ---- API Keys ----

export function useApiKeys() {
  return useQuery({
    queryKey: queryKeys.apiKeys.list(),
    queryFn: () => api.get<ApiKey[]>("/api-keys"),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) =>
      api.post<ApiKeyWithSecret>("/api-keys", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
    },
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => api.delete(`/api-keys/${keyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
    },
  });
}

// ---- CSV Uploads ----

export function useCsvUploads() {
  return useQuery({
    queryKey: queryKeys.csvUploads.list(),
    queryFn: () => api.get<CsvUpload[]>("/csv/uploads"),
  });
}

export function useUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      api.upload<CsvUploadResponse>("/csv/upload", file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.csvUploads.list() });
    },
  });
}

export function useMapCsvColumns(uploadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mapping: CsvColumnMapping) =>
      api.post(`/csv/${uploadId}/map`, mapping),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.csvUploads.list() });
      qc.invalidateQueries({ queryKey: queryKeys.events.stats() });
    },
  });
}
