"use client";

import { useState, useMemo, useEffect } from "react";
import { Activity, Pause, Play } from "lucide-react";

import { useEvents } from "@/hooks/use-data";
import type { EventSource } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const ALL_SOURCES = "__all__";

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function SourceBadge({ source }: { source: EventSource }) {
  const variant =
    source === "api"
      ? "default"
      : source === "csv"
        ? "secondary"
        : "outline";

  return <Badge variant={variant}>{source}</Badge>;
}

function truncateJson(obj: Record<string, unknown>, maxLen = 80): string {
  const str = JSON.stringify(obj);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

export default function LiveEventsPage() {
  const [paused, setPaused] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>(ALL_SOURCES);

  const queryParams = useMemo(
    () => ({
      limit: 50,
      order: "desc" as const,
      event_type: eventTypeFilter || undefined,
      source:
        sourceFilter !== ALL_SOURCES
          ? (sourceFilter as EventSource)
          : undefined,
    }),
    [eventTypeFilter, sourceFilter]
  );

  const { data, isLoading, refetch } = useEvents(queryParams);

  // Poll every 3 seconds when not paused
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [paused, refetch]);

  const events = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Live Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time stream of incoming events (polling every 3s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!paused && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused(!paused)}
          >
            {paused ? (
              <>
                <Play className="size-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="size-4" />
                Pause
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-type-filter">Event Type</Label>
            <Input
              id="event-type-filter"
              placeholder="Filter by event type..."
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-[220px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select
              value={sourceFilter}
              onValueChange={(v) => v && setSourceFilter(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SOURCES}>All Sources</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(eventTypeFilter || sourceFilter !== ALL_SOURCES) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEventTypeFilter("");
                setSourceFilter(ALL_SOURCES);
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Events table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Events
            {events.length > 0 && (
              <Badge variant="secondary">{events.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Showing the latest {events.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="size-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No events found
              </p>
              <p className="text-xs text-muted-foreground">
                {eventTypeFilter || sourceFilter !== ALL_SOURCES
                  ? "Try adjusting your filters"
                  : "Events will appear here as they are ingested"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Timestamp</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Actor ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Properties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">
                      {formatTimestamp(event.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.event_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.actor_id ?? (
                        <span className="italic text-muted-foreground/50">
                          none
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SourceBadge source={event.source} />
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <code className="text-xs text-muted-foreground">
                        {truncateJson(event.properties)}
                      </code>
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
