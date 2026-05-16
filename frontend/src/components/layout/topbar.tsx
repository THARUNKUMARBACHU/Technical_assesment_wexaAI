"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Building2,
  Check,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useLogout, useSwitchOrg } from "@/hooks/use-auth";
import { useOrgs } from "@/hooks/use-orgs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Map a pathname to human-readable breadcrumb segments. */
const segmentLabels: Record<string, string> = {
  dashboards: "Dashboards",
  alerts: "Alerts",
  data: "Data Sources",
  live: "Live Events",
  settings: "Settings",
};

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {segments.map((segment, index) => {
        const label =
          segmentLabels[segment] ||
          segment.charAt(0).toUpperCase() + segment.slice(1);
        const isLast = index === segments.length - 1;

        return (
          <span key={segment + index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
            <span
              className={
                isLast
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

function OrgSwitcher() {
  const { user } = useAuth();
  const { data: orgs } = useOrgs();
  const switchOrg = useSwitchOrg();

  if (!user?.current_org) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="gap-2 px-3 text-sm font-normal"
          />
        }
      >
        <Building2 className="size-4 text-muted-foreground" />
        <span className="max-w-[140px] truncate">
          {user.current_org.name}
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs?.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                if (org.id !== user.current_org.id) {
                  switchOrg.mutate({ org_id: org.id });
                }
              }}
              className="flex items-center justify-between"
            >
              <span className="truncate">{org.name}</span>
              {org.id === user.current_org.id && (
                <Check className="size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, clearAuth } = useAuth();
  const logout = useLogout();
  const router = useRouter();

  if (!user) return null;

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        router.push("/login");
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="relative size-8 rounded-full p-0" />
        }
      >
        <Avatar size="default">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium leading-none">
                {user.full_name}
              </p>
              <p className="text-xs text-muted-foreground leading-none">
                {user.email}
              </p>
              <Badge variant="secondary" className="w-fit capitalize">
                {user.current_org.role}
              </Badge>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <OrgSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
