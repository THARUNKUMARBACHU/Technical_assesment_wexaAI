"use client";

import { useState, useEffect } from "react";
import { Building2, User, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/auth-provider";
import { useOrg, useUpdateOrg } from "@/hooks/use-orgs";
import { useUpdateProfile } from "@/hooks/use-auth";
import { TeamTable } from "@/components/settings/team-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

function OrganizationTab() {
  const { user } = useAuth();
  const orgId = user?.current_org?.id ?? "";
  const { data: org, isLoading } = useOrg(orgId);
  const updateOrg = useUpdateOrg(orgId);

  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (org) {
      setOrgName(org.name);
    }
  }, [org]);

  async function handleSave() {
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    try {
      await updateOrg.mutateAsync({ name: orgName.trim() });
      toast.success("Organization updated");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update organization";
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>
          Manage your organization&apos;s profile and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="My Organization"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            value={org?.slug ?? ""}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            The slug is used in URLs and cannot be changed
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateOrg.isPending}>
          {updateOrg.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
    }
  }, [user]);

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    if (password && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password && password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      await updateProfile.mutateAsync({
        full_name: fullName.trim(),
        password: password || undefined,
      });
      toast.success("Profile updated");
      setPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Update your personal information and password
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full-name">Full Name</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={user?.email ?? ""}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            autoComplete="new-password"
          />
        </div>
        {password && (
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
          </div>
        )}
        <Button onClick={handleSave} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization, profile, and team
        </p>
      </div>

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">
            <Building2 className="size-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="size-4" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-4">
          <OrganizationTab />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
