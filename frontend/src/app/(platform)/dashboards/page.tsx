"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDashboards,
  useCreateDashboard,
  useDeleteDashboard,
  useDuplicateDashboard,
} from "@/hooks/use-dashboards";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlusIcon,
  SearchIcon,
  LayoutDashboardIcon,
  MoreVerticalIcon,
  PencilIcon,
  CopyIcon,
  TrashIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DashboardSummary } from "@/types/api";

export default function DashboardsPage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const router = useRouter();
  const { data: dashboards, isLoading } = useDashboards(filter);
  const createDashboard = useCreateDashboard();
  const deleteDashboard = useDeleteDashboard();

  const filtered = (dashboards ?? []).filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.description?.toLowerCase().includes(q) ?? false)
    );
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim()) return;
    createDashboard.mutate(
      {
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
      },
      {
        onSuccess: (dashboard) => {
          setCreateTitle("");
          setCreateDescription("");
          setCreateOpen(false);
          router.push(`/dashboards/${dashboard.id}`);
        },
      }
    );
  }

  function handleDelete(dashboardId: string) {
    deleteDashboard.mutate(dashboardId);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage your analytics dashboards.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button>
                <PlusIcon className="size-4" data-icon="inline-start" />
                Create Dashboard
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create Dashboard</DialogTitle>
                <DialogDescription>
                  Add a new dashboard to organize your widgets and analytics.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dash-title">Title</Label>
                  <Input
                    id="dash-title"
                    placeholder="e.g., Marketing Overview"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dash-desc">Description</Label>
                  <Input
                    id="dash-desc"
                    placeholder="Optional description..."
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDashboard.isPending || !createTitle.trim()}
                >
                  {createDashboard.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs
        defaultValue="all"
        onValueChange={(val) => {
          setFilter(val === "all" ? undefined : val);
        }}
      >
        <div className="flex items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">My Dashboards</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>
          <div className="relative ml-auto">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search dashboards..."
              className="pl-8 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="all">
          <DashboardGrid
            dashboards={filtered}
            isLoading={isLoading}
            onDelete={handleDelete}
            dashboardId=""
          />
        </TabsContent>
        <TabsContent value="mine">
          <DashboardGrid
            dashboards={filtered}
            isLoading={isLoading}
            onDelete={handleDelete}
            dashboardId=""
          />
        </TabsContent>
        <TabsContent value="shared">
          <DashboardGrid
            dashboards={filtered}
            isLoading={isLoading}
            onDelete={handleDelete}
            dashboardId=""
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardGrid({
  dashboards,
  isLoading,
  onDelete,
}: {
  dashboards: DashboardSummary[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  dashboardId: string;
}) {
  if (isLoading) {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-24" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-4 w-32" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <LayoutDashboardIcon className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">No dashboards yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first dashboard to start visualizing your data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {dashboards.map((dashboard) => (
        <DashboardCard
          key={dashboard.id}
          dashboard={dashboard}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function DashboardCard({
  dashboard,
  onDelete,
}: {
  dashboard: DashboardSummary;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const duplicate = useDuplicateDashboard(dashboard.id);

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/dashboards/${dashboard.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate">{dashboard.title}</CardTitle>
            {dashboard.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {dashboard.description}
              </CardDescription>
            )}
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="ml-2 shrink-0"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm">
                    <MoreVerticalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => router.push(`/dashboards/${dashboard.id}`)}
                >
                  <PencilIcon className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => duplicate.mutate()}
                >
                  <CopyIcon className="size-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(dashboard.id)}
                >
                  <TrashIcon className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {dashboard.widget_count} widget{dashboard.widget_count !== 1 ? "s" : ""}
          </Badge>
          {dashboard.is_default && (
            <Badge variant="outline">Default</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>{dashboard.created_by.full_name}</span>
          <span>
            {formatDistanceToNow(new Date(dashboard.updated_at), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
