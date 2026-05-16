/**
 * Auth hooks — contract definitions.
 * These hooks wrap TanStack Query mutations/queries for auth flows.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, setAccessToken } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  SwitchOrgRequest,
  SwitchOrgResponse,
  UpdateProfileRequest,
  UserWithOrg,
} from "@/types/api";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => api.get<UserWithOrg>("/auth/me"),
    staleTime: 5 * 60 * 1000, // 5 min
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      api.post<LoginResponse>("/auth/login", data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      api.post<RegisterResponse>("/auth/register", data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const refreshToken = localStorage.getItem("refresh_token");
      return api.post("/auth/logout", { refresh_token: refreshToken });
    },
    onSettled: () => {
      setAccessToken(null);
      localStorage.removeItem("refresh_token");
      qc.clear();
    },
  });
}

export function useSwitchOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SwitchOrgRequest) =>
      api.post<SwitchOrgResponse>("/auth/switch-org", data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      // Invalidate everything — new org context
      qc.invalidateQueries();
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) =>
      api.patch<UserWithOrg>("/auth/me", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}
