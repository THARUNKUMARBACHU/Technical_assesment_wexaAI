"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useCreateAlertRule, useUpdateAlertRule } from "@/hooks/use-alerts";
import type { AlertRule, NotificationChannel } from "@/types/api";

const alertRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  description: z.string().max(1000).optional().or(z.literal("")),
  severity: z.enum(["info", "warning", "critical"]),
  event_type: z.string().min(1, "Event type is required"),
  metric: z.enum(["count", "sum", "avg", "min", "max"]),
  operator: z.enum(["gt", "lt", "eq", "gte", "lte"]),
  threshold: z.number({ message: "Must be a number" }),
  time_window_minutes: z
    .number({})
    .min(1, "Must be at least 1 minute")
    .max(1440, "Must be at most 1440 minutes"),
  cooldown_minutes: z
    .number({})
    .min(0, "Must be at least 0")
    .max(1440, "Must be at most 1440 minutes"),
  channel_in_app: z.boolean(),
  channel_email: z.boolean(),
  channel_webhook: z.boolean(),
  email_recipients: z.string().optional().or(z.literal("")),
  webhook_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type AlertRuleFormValues = z.infer<typeof alertRuleSchema>;

interface AlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AlertRule | null;
}

function getDefaultValues(rule: AlertRule | null): AlertRuleFormValues {
  if (rule) {
    return {
      name: rule.name,
      description: rule.description ?? "",
      severity: rule.severity,
      event_type: rule.condition.event_type,
      metric: rule.condition.metric,
      operator: rule.condition.operator,
      threshold: rule.condition.threshold,
      time_window_minutes: rule.condition.time_window_minutes,
      cooldown_minutes: rule.cooldown_minutes,
      channel_in_app: rule.notification_channels.includes("in_app"),
      channel_email: rule.notification_channels.includes("email"),
      channel_webhook: rule.notification_channels.includes("webhook"),
      email_recipients: rule.email_recipients?.join(", ") ?? "",
      webhook_url: rule.webhook_url ?? "",
    };
  }
  return {
    name: "",
    description: "",
    severity: "warning",
    event_type: "",
    metric: "count",
    operator: "gt",
    threshold: 0,
    time_window_minutes: 5,
    cooldown_minutes: 15,
    channel_in_app: true,
    channel_email: false,
    channel_webhook: false,
    email_recipients: "",
    webhook_url: "",
  };
}

export function AlertRuleDialog({
  open,
  onOpenChange,
  rule,
}: AlertRuleDialogProps) {
  const isEditing = !!rule;
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule(rule?.id ?? "");

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: getDefaultValues(rule),
  });

  const channelEmail = watch("channel_email");
  const channelWebhook = watch("channel_webhook");

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(rule));
    }
  }, [open, rule, reset]);

  const onSubmit = (values: AlertRuleFormValues) => {
    const channels: NotificationChannel[] = [];
    if (values.channel_in_app) channels.push("in_app");
    if (values.channel_email) channels.push("email");
    if (values.channel_webhook) channels.push("webhook");

    const payload = {
      name: values.name,
      description: values.description || undefined,
      severity: values.severity,
      condition: {
        event_type: values.event_type,
        metric: values.metric,
        operator: values.operator,
        threshold: values.threshold,
        time_window_minutes: values.time_window_minutes,
      },
      cooldown_minutes: values.cooldown_minutes,
      notification_channels: channels,
      email_recipients: values.email_recipients
        ? values.email_recipients
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        : undefined,
      webhook_url: values.webhook_url || undefined,
    };

    const mutation = isEditing ? updateRule : createRule;

    mutation.mutate(payload as any, {
      onSuccess: () => {
        toast.success(
          isEditing ? "Alert rule updated" : "Alert rule created"
        );
        onOpenChange(false);
      },
      onError: () => {
        toast.error(
          isEditing
            ? "Failed to update alert rule"
            : "Failed to create alert rule"
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Alert Rule" : "Create Alert Rule"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the alert rule configuration."
              : "Define a new alert rule to monitor your events."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 max-h-[60vh] overflow-y-auto pr-1"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. High error rate" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description..."
              className="min-h-[60px]"
              {...register("description")}
            />
          </div>

          {/* Severity */}
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Separator />

          {/* Condition Builder */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Condition</Label>

            <div className="space-y-1.5">
              <Label htmlFor="event_type" className="text-xs text-muted-foreground">
                Event Type
              </Label>
              <Input
                id="event_type"
                placeholder="e.g. page_view, error, purchase"
                {...register("event_type")}
              />
              {errors.event_type && (
                <p className="text-xs text-destructive">
                  {errors.event_type.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Metric</Label>
                <Controller
                  control={control}
                  name="metric"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                        <SelectItem value="avg">Average</SelectItem>
                        <SelectItem value="min">Min</SelectItem>
                        <SelectItem value="max">Max</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Operator</Label>
                <Controller
                  control={control}
                  name="operator"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gt">Greater than</SelectItem>
                        <SelectItem value="gte">Greater or equal</SelectItem>
                        <SelectItem value="eq">Equal to</SelectItem>
                        <SelectItem value="lte">Less or equal</SelectItem>
                        <SelectItem value="lt">Less than</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="threshold" className="text-xs text-muted-foreground">
                  Threshold
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  step="any"
                  {...register("threshold")}
                />
                {errors.threshold && (
                  <p className="text-xs text-destructive">
                    {errors.threshold.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="time_window_minutes" className="text-xs text-muted-foreground">
                  Time Window (minutes)
                </Label>
                <Input
                  id="time_window_minutes"
                  type="number"
                  min={1}
                  max={1440}
                  {...register("time_window_minutes")}
                />
                {errors.time_window_minutes && (
                  <p className="text-xs text-destructive">
                    {errors.time_window_minutes.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cooldown_minutes" className="text-xs text-muted-foreground">
                  Cooldown (minutes)
                </Label>
                <Input
                  id="cooldown_minutes"
                  type="number"
                  min={0}
                  max={1440}
                  {...register("cooldown_minutes")}
                />
                {errors.cooldown_minutes && (
                  <p className="text-xs text-destructive">
                    {errors.cooldown_minutes.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Notification Channels */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Notification Channels</Label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="channel_in_app" className="text-sm font-normal">
                  In-App Notification
                </Label>
                <Controller
                  control={control}
                  name="channel_in_app"
                  render={({ field }) => (
                    <Switch
                      id="channel_in_app"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="channel_email" className="text-sm font-normal">
                  Email
                </Label>
                <Controller
                  control={control}
                  name="channel_email"
                  render={({ field }) => (
                    <Switch
                      id="channel_email"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              {channelEmail && (
                <div className="space-y-1.5 pl-4">
                  <Label
                    htmlFor="email_recipients"
                    className="text-xs text-muted-foreground"
                  >
                    Email Recipients (comma separated)
                  </Label>
                  <Input
                    id="email_recipients"
                    placeholder="alice@example.com, bob@example.com"
                    {...register("email_recipients")}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="channel_webhook" className="text-sm font-normal">
                  Webhook
                </Label>
                <Controller
                  control={control}
                  name="channel_webhook"
                  render={({ field }) => (
                    <Switch
                      id="channel_webhook"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              {channelWebhook && (
                <div className="space-y-1.5 pl-4">
                  <Label
                    htmlFor="webhook_url"
                    className="text-xs text-muted-foreground"
                  >
                    Webhook URL
                  </Label>
                  <Input
                    id="webhook_url"
                    placeholder="https://hooks.example.com/alerts"
                    {...register("webhook_url")}
                  />
                  {errors.webhook_url && (
                    <p className="text-xs text-destructive">
                      {errors.webhook_url.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
