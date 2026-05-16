"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Bell,
  BellOff,
  Trash2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertRuleDialog } from "@/components/alerts/alert-rule-dialog";
import {
  useAlertRules,
  useDeleteAlertRule,
  useToggleAlertRule,
  useMuteAlertRule,
  useUnmuteAlertRule,
} from "@/hooks/use-alerts";
import type { AlertRule, AlertOperator } from "@/types/api";

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  critical:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: ">",
  lt: "<",
  eq: "=",
  gte: ">=",
  lte: "<=",
};

function formatCondition(rule: AlertRule): string {
  const { condition } = rule;
  return `${condition.metric}(${condition.event_type}) ${OPERATOR_LABELS[condition.operator]} ${condition.threshold} in ${condition.time_window_minutes}m`;
}

function RuleStatus({ rule }: { rule: AlertRule }) {
  if (!rule.is_enabled) {
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Disabled
      </Badge>
    );
  }
  if (rule.is_muted) {
    return (
      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        <BellOff className="size-3" />
        Muted
        {rule.muted_until && (
          <span className="ml-1 text-[10px] opacity-75">
            until {new Date(rule.muted_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Enabled
    </Badge>
  );
}

function RuleActions({
  rule,
  onEdit,
}: {
  rule: AlertRule;
  onEdit: (rule: AlertRule) => void;
}) {
  const deleteRule = useDeleteAlertRule();
  const toggleRule = useToggleAlertRule(rule.id);
  const muteRule = useMuteAlertRule(rule.id);
  const unmuteRule = useUnmuteAlertRule(rule.id);

  const handleToggle = () => {
    toggleRule.mutate(
      { is_enabled: !rule.is_enabled },
      {
        onSuccess: () => {
          toast.success(
            rule.is_enabled ? "Alert rule disabled" : "Alert rule enabled"
          );
        },
        onError: () => {
          toast.error("Failed to toggle alert rule");
        },
      }
    );
  };

  const handleMute = (minutes: number) => {
    muteRule.mutate(
      { duration_minutes: minutes },
      {
        onSuccess: () => {
          toast.success(`Alert rule muted for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}`);
        },
        onError: () => {
          toast.error("Failed to mute alert rule");
        },
      }
    );
  };

  const handleUnmute = () => {
    unmuteRule.mutate(undefined, {
      onSuccess: () => {
        toast.success("Alert rule unmuted");
      },
      onError: () => {
        toast.error("Failed to unmute alert rule");
      },
    });
  };

  const handleDelete = () => {
    deleteRule.mutate(rule.id, {
      onSuccess: () => {
        toast.success("Alert rule deleted");
      },
      onError: () => {
        toast.error("Failed to delete alert rule");
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(rule)}>
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleToggle}>
          {rule.is_enabled ? (
            <>
              <PowerOff className="size-4" />
              Disable
            </>
          ) : (
            <>
              <Power className="size-4" />
              Enable
            </>
          )}
        </DropdownMenuItem>

        {rule.is_enabled && !rule.is_muted && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BellOff className="size-4" />
              Mute
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleMute(30)}>
                <Clock className="size-4" />
                30 minutes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMute(60)}>
                <Clock className="size-4" />
                1 hour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMute(240)}>
                <Clock className="size-4" />
                4 hours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMute(1440)}>
                <Clock className="size-4" />
                24 hours
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {rule.is_muted && (
          <DropdownMenuItem onClick={handleUnmute}>
            <Bell className="size-4" />
            Unmute
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AlertRulesTable() {
  const { data: rules, isLoading } = useAlertRules();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const handleCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingRule(null);
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rules?.length ?? 0} alert rule{(rules?.length ?? 0) !== 1 ? "s" : ""}
        </p>
        <Button onClick={handleCreate} size="sm">
          <Plus className="size-4" />
          Create Alert Rule
        </Button>
      </div>

      {rules && rules.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Triggered</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-medium text-left hover:underline focus:outline-none"
                      onClick={() => handleEdit(rule)}
                    >
                      {rule.name}
                    </button>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[300px] truncate">
                        {rule.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={SEVERITY_STYLES[rule.severity]}
                    >
                      {rule.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {formatCondition(rule)}
                    </code>
                  </TableCell>
                  <TableCell>
                    <RuleStatus rule={rule} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {rule.last_triggered_at
                      ? formatDistanceToNow(new Date(rule.last_triggered_at), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <RuleActions rule={rule} onEdit={handleEdit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Bell className="size-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-sm font-medium">No alert rules</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first alert rule to get started.
          </p>
          <Button onClick={handleCreate} size="sm" className="mt-4">
            <Plus className="size-4" />
            Create Alert Rule
          </Button>
        </div>
      )}

      <AlertRuleDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        rule={editingRule}
      />
    </div>
  );
}
