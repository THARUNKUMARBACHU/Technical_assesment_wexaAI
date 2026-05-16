"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useDashboard,
  useUpdateDashboard,
  useDeleteWidget,
  useShareDashboard,
} from "@/hooks/use-dashboards";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import { WidgetAddDialog } from "@/components/dashboard/widget-add-dialog";
import {
  ArrowLeftIcon,
  ShareIcon,
  PencilIcon,
  TrashIcon,
  MoreVerticalIcon,
  CopyIcon,
  CheckIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";

const TIME_RANGES = [
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export default function DashboardDetailPage({
  params,
}: {
  params: Promise<{ dashboardId: string }>;
}) {
  const { dashboardId } = use(params);
  const router = useRouter();

  const { canEdit } = useRole();
  const { data: dashboard, isLoading, isError } = useDashboard(dashboardId);
  const updateDashboard = useUpdateDashboard(dashboardId);
  const deleteWidget = useDeleteWidget(dashboardId);
  const shareDashboard = useShareDashboard(dashboardId);

  const [timeRange, setTimeRange] = useState("24h");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  useEffect(() => {
    if (dashboard) {
      setTitleValue(dashboard.title);
      setAutoRefresh(!!dashboard.auto_refresh_seconds);
    }
  }, [dashboard]);

  const handleAutoRefreshToggle = useCallback(
    (checked: boolean) => {
      setAutoRefresh(checked);
      updateDashboard.mutate({
        auto_refresh_seconds: checked ? 30 : undefined,
      });
    },
    [updateDashboard]
  );

  function handleTitleSave() {
    if (titleValue.trim() && titleValue !== dashboard?.title) {
      updateDashboard.mutate({ title: titleValue.trim() });
    }
    setEditingTitle(false);
  }

  function handleShare() {
    shareDashboard.mutate(
      { permission: "view" },
      {
        onSuccess: (share) => {
          const link = `${window.location.origin}/shared/${share.share_token}`;
          setShareLink(link);
        },
      }
    );
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  function handleDeleteWidget(widgetId: string) {
    deleteWidget.mutate(widgetId);
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !dashboard) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <LayoutDashboardIcon className="size-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Dashboard not found</h2>
        <p className="text-sm text-muted-foreground">
          The dashboard you are looking for does not exist or you do not have access.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboards")}>
          <ArrowLeftIcon className="size-4" data-icon="inline-start" />
          Back to Dashboards
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/dashboards")}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>

        {canEdit && editingTitle ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleTitleSave();
            }}
          >
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              className="h-8 w-64 text-lg font-bold"
              autoFocus
              onBlur={handleTitleSave}
            />
          </form>
        ) : (
          <h1
            className={`text-xl font-bold tracking-tight${canEdit ? " cursor-pointer hover:text-foreground/80" : ""}`}
            onClick={canEdit ? () => setEditingTitle(true) : undefined}
          >
            {dashboard.title}
          </h1>
        )}

        {dashboard.is_default && (
          <Badge variant="outline">Default</Badge>
        )}

        <div className="ml-auto flex items-center gap-3">
          {canEdit && (
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground">
                Auto-refresh
              </Label>
              <Switch
                id="auto-refresh"
                size="sm"
                checked={autoRefresh}
                onCheckedChange={handleAutoRefreshToggle}
              />
            </div>
          )}

          <Select value={timeRange} onValueChange={(v) => v && setTimeRange(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEdit && (
            <WidgetAddDialog
              dashboardId={dashboardId}
              existingWidgetCount={dashboard.widgets.length}
            />
          )}

          {canEdit && <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  <ShareIcon className="size-4" data-icon="inline-start" />
                  Share
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Dashboard</DialogTitle>
                <DialogDescription>
                  Generate a share link for this dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                {shareLink ? (
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={shareLink}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                    >
                      {shareCopied ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <CopyIcon className="size-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleShare}
                    disabled={shareDashboard.isPending}
                    className="w-full"
                  >
                    {shareDashboard.isPending
                      ? "Generating..."
                      : "Generate Share Link"}
                  </Button>
                )}
              </div>
              <DialogFooter className="mt-4" showCloseButton />
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      {/* Widget Grid */}
      {dashboard.widgets.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <LayoutDashboardIcon className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No widgets yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first widget to start visualizing data on this dashboard.
            </p>
          </div>
          {canEdit && (
            <WidgetAddDialog
              dashboardId={dashboardId}
              existingWidgetCount={0}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.widgets.map((widget) => (
            <div
              key={widget.id}
              className="relative"
              style={{
                minHeight:
                  widget.widget_type === "kpi" ? "180px" : "320px",
              }}
            >
              {canEdit && (
                <div className="absolute right-2 top-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-xs">
                          <MoreVerticalIcon className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteWidget(widget.id)}
                      >
                        <TrashIcon className="size-4" />
                        Delete Widget
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <WidgetRenderer
                widget={widget}
                dashboardId={dashboardId}
                timeRange={timeRange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-7" />
        <Skeleton className="h-7 w-48" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="h-64">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
