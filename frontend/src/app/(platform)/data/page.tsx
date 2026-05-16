"use client";

import { useRouter } from "next/navigation";
import {
  Activity,
  Gauge,
  Key,
  Upload,
  Webhook,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";

import { useEventStats } from "@/hooks/use-data";
import { useCsvUploads } from "@/hooks/use-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "processing"
          ? "secondary"
          : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DataOverviewPage() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading } = useEventStats();
  const { data: uploads, isLoading: uploadsLoading } = useCsvUploads();

  const recentUploads = uploads?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your event ingestion pipeline
        </p>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <StatsLoadingSkeleton />
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Today&apos;s Events</CardDescription>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {stats.today_count.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Events / min</CardDescription>
              <Gauge className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {stats.events_per_minute.toFixed(1)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Active API Keys</CardDescription>
              <Key className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.active_api_keys}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>CSV Uploads This Month</CardDescription>
              <Upload className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {stats.csv_uploads_this_month}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Source breakdown + quick links */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Source breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Source Breakdown</CardTitle>
            <CardDescription>
              Events received by ingestion source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : stats ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="size-4 text-muted-foreground" />
                    <span className="text-sm">API</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats.sources.api.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-4 text-muted-foreground" />
                    <span className="text-sm">CSV</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats.sources.csv.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="size-4 text-muted-foreground" />
                    <span className="text-sm">Webhook</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats.sources.webhook.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Manage your data ingestion pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push("/data/api-keys")}
            >
              <span className="flex items-center gap-2">
                <Key className="size-4" />
                Manage API Keys
              </span>
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push("/data/upload")}
            >
              <span className="flex items-center gap-2">
                <Upload className="size-4" />
                Upload CSV
              </span>
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push("/data/live")}
            >
              <span className="flex items-center gap-2">
                <Activity className="size-4" />
                Live Events Stream
              </span>
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Recent CSV uploads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent CSV Uploads</CardTitle>
          <CardDescription>
            Your latest CSV file imports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploadsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileSpreadsheet className="size-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No CSV uploads yet
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push("/data/upload")}
              >
                Upload your first CSV
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell className="font-medium">
                      {upload.filename}
                    </TableCell>
                    <TableCell>
                      {formatBytes(upload.file_size_bytes)}
                    </TableCell>
                    <TableCell>
                      {upload.row_count?.toLocaleString() ?? "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={upload.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(upload.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
