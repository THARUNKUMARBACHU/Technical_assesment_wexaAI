import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  OrgSummary,
  Organization,
  CreateOrgRequest,
  UpdateOrgRequest,
  Member,
  UpdateMemberRequest,
  Invitation,
  CreateInvitationRequest,
} from "@/types/api";

// ---- Orgs ----

export function useOrgs() {
  return useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: () => api.get<OrgSummary[]>("/orgs"),
  });
}

export function useOrg(orgId: string) {
  return useQuery({
    queryKey: queryKeys.orgs.detail(orgId),
    queryFn: () => api.get<Organization>(`/orgs/${orgId}`),
    enabled: !!orgId,
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrgRequest) =>
      api.post<Organization>("/orgs", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.list() });
    },
  });
}

export function useUpdateOrg(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateOrgRequest) =>
      api.patch<Organization>(`/orgs/${orgId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.detail(orgId) });
      qc.invalidateQueries({ queryKey: queryKeys.orgs.list() });
    },
  });
}

// ---- Members ----

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.orgs.members(orgId),
    queryFn: () => api.get<Member[]>(`/orgs/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function useUpdateMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: UpdateMemberRequest }) =>
      api.patch(`/orgs/${orgId}/members/${memberId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.members(orgId) });
    },
  });
}

export function useRemoveMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/orgs/${orgId}/members/${memberId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.members(orgId) });
    },
  });
}

// ---- Invitations ----

export function useInvitations(orgId: string) {
  return useQuery({
    queryKey: queryKeys.orgs.invitations(orgId),
    queryFn: () => api.get<Invitation[]>(`/orgs/${orgId}/invitations`),
    enabled: !!orgId,
  });
}

export function useCreateInvitation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvitationRequest) =>
      api.post<Invitation>(`/orgs/${orgId}/invitations`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.invitations(orgId) });
    },
  });
}

export function useRevokeInvitation(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(`/orgs/${orgId}/invitations/${invitationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs.invitations(orgId) });
    },
  });
}
