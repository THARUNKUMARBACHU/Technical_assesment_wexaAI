"use client";

import { useState } from "react";
import { UserPlus, Trash2, Mail, Clock, Shield } from "lucide-react";
import { toast } from "sonner";

import {
  useMembers,
  useUpdateMember,
  useRemoveMember,
  useInvitations,
  useCreateInvitation,
  useRevokeInvitation,
} from "@/hooks/use-orgs";
import { useAuth } from "@/providers/auth-provider";
import type { Role } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES: Role[] = ["owner", "admin", "analyst", "viewer"];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function canManageMembers(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function TeamTable() {
  const { user } = useAuth();
  const orgId = user?.current_org?.id ?? "";
  const currentRole = user?.current_org?.role ?? "viewer";
  const isManager = canManageMembers(currentRole);

  const { data: members, isLoading: membersLoading } = useMembers(orgId);
  const { data: invitations, isLoading: invitationsLoading } =
    useInvitations(orgId);
  const updateMember = useUpdateMember(orgId);
  const removeMember = useRemoveMember(orgId);
  const createInvitation = useCreateInvitation(orgId);
  const revokeInvitation = useRevokeInvitation(orgId);

  // Remove confirmation
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");

  async function handleRoleChange(memberId: string, role: Role) {
    try {
      await updateMember.mutateAsync({ memberId, data: { role } });
      toast.success("Member role updated");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update role";
      toast.error(message);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await removeMember.mutateAsync(removeTarget.id);
      toast.success(`${removeTarget.name} has been removed`);
      setRemoveDialogOpen(false);
      setRemoveTarget(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to remove member";
      toast.error(message);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    try {
      await createInvitation.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("viewer");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send invitation";
      toast.error(message);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      await revokeInvitation.mutateAsync(invitationId);
      toast.success("Invitation revoked");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to revoke invitation";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            People who have access to this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !members || members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No members found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {isManager && <TableHead className="w-16">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name}
                      {member.user_id === user?.id && (
                        <Badge variant="secondary" className="ml-2">
                          You
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      {isManager && member.user_id !== user?.id ? (
                        <Select
                          value={member.role}
                          onValueChange={(role) =>
                            handleRoleChange(member.id, role as Role)
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          <Shield className="size-3" />
                          {member.role.charAt(0).toUpperCase() +
                            member.role.slice(1)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(member.created_at)}
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        {member.user_id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setRemoveTarget({
                                id: member.id,
                                name: member.full_name,
                              });
                              setRemoveDialogOpen(true);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Remove confirmation */}
      <Dialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          setRemoveDialogOpen(open);
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removeTarget?.name} from the
              organization? They will lose access to all resources.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Pending Invitations
          </CardTitle>
          <CardDescription>
            Invitations that have been sent but not yet accepted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !invitations || invitations.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No pending invitations
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Expires</TableHead>
                  {isManager && <TableHead className="w-16">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.invited_by}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.expires_at)}
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRevokeInvitation(inv.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite form */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Invite Member
            </CardTitle>
            <CardDescription>
              Send an invitation to join your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email Address</Label>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as Role)}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.filter((r) => r !== "owner").map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleInvite}
                disabled={createInvitation.isPending}
              >
                {createInvitation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
