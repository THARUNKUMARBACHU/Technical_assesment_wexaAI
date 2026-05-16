"use client";

import { useState, useCallback } from "react";
import { Copy, Key, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/hooks/use-data";
import type { ApiKeyScope, ApiKeyWithSecret } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function maskKey(prefix: string): string {
  return `${prefix}${"*".repeat(8)}`;
}

export default function ApiKeysPage() {
  const { data: keys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [scopeIngest, setScopeIngest] = useState(true);
  const [scopeRead, setScopeRead] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);

  const resetCreateForm = useCallback(() => {
    setName("");
    setScopeIngest(true);
    setScopeRead(false);
    setExpiresAt("");
  }, []);

  async function handleCreate() {
    const scopes: ApiKeyScope[] = [];
    if (scopeIngest) scopes.push("ingest");
    if (scopeRead) scopes.push("read");

    if (!name.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }
    if (scopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }

    try {
      const result = await createApiKey.mutateAsync({
        name: name.trim(),
        scopes,
        expires_at: expiresAt || undefined,
      });
      setCreatedKey(result);
      setCreateOpen(false);
      setSecretDialogOpen(true);
      resetCreateForm();
      toast.success("API key created successfully");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create API key";
      toast.error(message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteApiKey.mutateAsync(deleteTarget.id);
      toast.success(`API key "${deleteTarget.name}" deleted`);
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete API key";
      toast.error(message);
    }
  }

  function handleCopyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.key);
    toast.success("API key copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage API keys for event ingestion
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-4" />
                Create API Key
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for event ingestion or data access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production Ingest"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Scopes</Label>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="scope-ingest" className="text-sm font-normal">
                      Ingest
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send events to the API
                    </p>
                  </div>
                  <Switch
                    id="scope-ingest"
                    checked={scopeIngest}
                    onCheckedChange={setScopeIngest}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="scope-read" className="text-sm font-normal">
                      Read
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Query events and analytics
                    </p>
                  </div>
                  <Switch
                    id="scope-read"
                    checked={scopeRead}
                    onCheckedChange={setScopeRead}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires-at">
                  Expires At{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="expires-at"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                onClick={handleCreate}
                disabled={createApiKey.isPending}
              >
                {createApiKey.isPending ? "Creating..." : "Create Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Secret key dialog - shown after creation */}
      <Dialog
        open={secretDialogOpen}
        onOpenChange={(open) => {
          setSecretDialogOpen(open);
          if (!open) setCreatedKey(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                <code className="flex-1 break-all text-sm font-mono">
                  {createdKey.key}
                </code>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={handleCopyKey}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  Make sure to copy your API key now. You will not be able to
                  see it again after closing this dialog.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSecretDialogOpen(false)}>
              I&apos;ve copied the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the API key &quot;
              {deleteTarget?.name}&quot;? This action cannot be undone. Any
              applications using this key will lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteApiKey.isPending}
            >
              {deleteApiKey.isPending ? "Deleting..." : "Delete Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Keys</CardTitle>
          <CardDescription>
            Keys used by your applications to interact with the API
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !keys || keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Key className="size-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No API keys yet
              </p>
              <p className="text-xs text-muted-foreground">
                Create your first API key to start ingesting events
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {maskKey(key.key_prefix)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.last_used_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.expires_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setDeleteTarget({
                            id: key.id,
                            name: key.name,
                          });
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
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
