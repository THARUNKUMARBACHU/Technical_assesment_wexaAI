"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  Database,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/stores/ui-store";

const navItems = [
  { label: "Dashboards", href: "/dashboards", icon: LayoutDashboard },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Data Sources", href: "/data", icon: Database },
  { label: "Live Events", href: "/data/live", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-4",
          collapsed && "justify-center px-0"
        )}
      >
        <Link href="/dashboards" className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            L
          </div>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">
              LoopBoard
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <TooltipProvider>
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (String(item.href) !== "/" && pathname.startsWith(String(item.href) + "/")) ||
                (item.href === "/data" && pathname === "/data");

              // Special case: /data/live should not mark /data as active
              const isDataParent =
                item.href === "/data" && pathname.startsWith("/data/live");
              const isLiveChild =
                item.href === "/data/live" && pathname.startsWith("/data/live");

              const active = isLiveChild
                ? true
                : isDataParent
                  ? false
                  : isActive;

              const linkContent = (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active &&
                      "bg-sidebar-accent text-sidebar-accent-foreground",
                    !active && "text-sidebar-foreground/70",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className="size-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger className="w-full">
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              }

              return <li key={item.href}>{linkContent}</li>;
            })}
          </ul>
        </TooltipProvider>
      </nav>

      {/* Collapse toggle */}
      <Separator />
      <div
        className={cn(
          "flex shrink-0 items-center p-2",
          collapsed ? "justify-center" : "justify-end"
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="size-8 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                />
              }
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  );
}
