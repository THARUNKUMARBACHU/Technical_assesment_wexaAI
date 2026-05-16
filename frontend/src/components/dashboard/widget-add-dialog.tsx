"use client";

import { useState } from "react";
import { useCreateWidget } from "@/hooks/use-dashboards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon } from "lucide-react";
import type { WidgetType, AggregationType, TimeBucket } from "@/types/api";

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: "line", label: "Line Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "kpi", label: "KPI Card" },
  { value: "table", label: "Data Table" },
];

const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

const TIME_BUCKETS: { value: TimeBucket; label: string }[] = [
  { value: "minute", label: "Minute" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

interface WidgetAddDialogProps {
  dashboardId: string;
  existingWidgetCount: number;
}

export function WidgetAddDialog({
  dashboardId,
  existingWidgetCount,
}: WidgetAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [widgetType, setWidgetType] = useState<WidgetType>("line");
  const [eventType, setEventType] = useState("");
  const [aggregation, setAggregation] = useState<AggregationType>("count");
  const [timeBucket, setTimeBucket] = useState<TimeBucket>("hour");

  const createWidget = useCreateWidget(dashboardId);

  function resetForm() {
    setTitle("");
    setWidgetType("line");
    setEventType("");
    setAggregation("count");
    setTimeBucket("hour");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventType.trim()) return;

    const col = existingWidgetCount % 3;
    const row = Math.floor(existingWidgetCount / 3);

    createWidget.mutate(
      {
        title: title.trim(),
        widget_type: widgetType,
        config: {
          event_type: eventType.trim(),
          aggregation,
          time_bucket: timeBucket,
          group_by: null,
          filters: [],
        },
        time_range: {
          type: "relative",
          value: "24h",
        },
        position: {
          x: col * 4,
          y: row * 4,
          w: widgetType === "kpi" ? 3 : 4,
          h: widgetType === "kpi" ? 2 : 4,
        },
      },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon className="size-4" data-icon="inline-start" />
            Add Widget
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Create a new widget to visualize your event data.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="widget-title">Title</Label>
              <Input
                id="widget-title"
                placeholder="e.g., Daily Active Users"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Widget Type</Label>
              <Select value={widgetType} onValueChange={(val) => setWidgetType(val as WidgetType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-type">Event Type</Label>
              <Input
                id="event-type"
                placeholder="e.g., page_view, purchase"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Aggregation</Label>
                <Select value={aggregation} onValueChange={(val) => setAggregation(val as AggregationType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((agg) => (
                      <SelectItem key={agg.value} value={agg.value}>
                        {agg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Time Bucket</Label>
                <Select value={timeBucket} onValueChange={(val) => setTimeBucket(val as TimeBucket)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_BUCKETS.map((bucket) => (
                      <SelectItem key={bucket.value} value={bucket.value}>
                        {bucket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createWidget.isPending || !title.trim() || !eventType.trim()}
            >
              {createWidget.isPending ? "Creating..." : "Add Widget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
