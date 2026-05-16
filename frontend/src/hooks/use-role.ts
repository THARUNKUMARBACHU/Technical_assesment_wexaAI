import { useAuth } from "@/providers/auth-provider";
import type { Role } from "@/types/api";

/**
 * Permission map matching backend require_role() enforcement.
 *
 * owner  > admin > analyst > viewer
 */
const ROLE_LEVEL: Record<Role, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
};

export function useRole() {
  const { user } = useAuth();
  const role: Role = user?.current_org?.role ?? "viewer";

  return {
    role,
    /** true if role is owner or admin */
    isManager: role === "owner" || role === "admin",
    /** true if role is owner, admin, or analyst (can create/edit content) */
    canEdit: role !== "viewer",
    /** true if role is owner */
    isOwner: role === "owner",
    /** Check if user has at least the given role level */
    hasRole: (...allowed: Role[]) => allowed.includes(role),
    /** Check if user's role is at or above a minimum level */
    atLeast: (minRole: Role) => ROLE_LEVEL[role] >= ROLE_LEVEL[minRole],
  };
}
