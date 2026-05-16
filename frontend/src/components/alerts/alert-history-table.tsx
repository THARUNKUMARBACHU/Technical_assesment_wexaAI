"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  AlertTriangle,
  Filter,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAlertEvents,
  useAcknowledgeAlert,
  useResolveAlert,
} from "@/hooks/use-alerts";
import type {
  AlertEventStatus,
  AlertOperator,
  AlertEventsQueryParams,
} from "@/types/api";

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  critical:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_STYLES: Record<AlertEventStatus, string> = {
  firing:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  acknowledged:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  resolved:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: ">",
  lt: "<",
  eq: "=",
  gte: ">=",
  lte: "<=",
};

type StatusFilter = AlertEventStatus | "all";
type TimeRangeFilter = "24h" | "7d" | "30d";

export function AlertHistoryTable() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>("24h");

  const params: AlertEventsQueryParams = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    time_range: timeRange,
    limit: 50,
  };

  const { data: response, isLoading } = useAlertEvents(params);
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();

  const events = response?.items ?? [];

  const handleAcknowledge = (eventId: string) => {
    acknowledgeAlert.mutate(eventId, {
      onSuccess: () => {
        toast.success("Alert acknowledged");
      },
      onError: () => {
        toast.error("Failed to acknowledge alert");
      },
    });
  };

  const handleResolve = (eventId: string) => {
    resolveAlert.mutate(eventId, {
      onSuccess: () => {
        toast.success("Alert resolved");
      },
      onError: () => {
        toast.error("Failed to resolve alert");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>

        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val as StatusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="firing">Firing</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={timeRange}
          onValueChange={(val) => setTimeRange(val as TimeRangeFilter)}
        >
          <SelectTrigger className="w-[130px]">
            <Clock className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground">
          {response?.total ?? 0} event{(response?.total ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>

      {events.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value vs Threshold</TableHead>
                <TableHead>Fired At</TableHead>
                <TableHead>Resolved At</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">
                    {event.rule_name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={SEVERITY_STYLES[event.severity]}
                    >
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={STATUS_STYLES[event.status]}
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {event.triggered_value.toLocaleString()}{" "}
                      {OPERATOR_LABELS[event.operator]}{" "}
                      {event.threshold_value.toLocaleString()}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span title={format(new Date(event.fired_at), "PPpp")}>
                      {formatDistanceToNow(new Date(event.fired_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.resolved_at ? (
                      <span
                        title={format(new Date(event.resolved_at), "PPpp")}
                      >
                        {formatDistanceToNow(new Date(event.resolved_at), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {event.status === "firing" && (
                        <>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleAcknowledge(event.id)}
                            disabled={acknowledgeAlert.isPending}
                            title="Acknowledge"
                          >
                            <Eye className="size-3.5" />
                            Ack
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleResolve(event.id)}
                            disabled={resolveAlert.isPending}
                            title="Resolve"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Resolve
                          </Button>
                        </>
                      )}
                      {event.status === "acknowledged" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleResolve(event.id)}
                          disabled={resolveAlert.isPending}
                          title="Resolve"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Resolve
                        </Button>
                      )}
                      {event.status === "resolved" && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                          <CheckCircle2 className="size-3.5" />
                          Done
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <AlertTriangle className="size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-medium">No alert events</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter !== "all"
              ? `No ${statusFilter} alerts in the selected time range.`
              : "No alerts have been triggered in the selected time range."}
          </p>
        </div>
      )}
    </div>
  );
}
