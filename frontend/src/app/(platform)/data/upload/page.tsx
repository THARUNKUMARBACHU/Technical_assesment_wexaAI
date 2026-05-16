"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  useCsvUploads,
  useUploadCsv,
  useMapCsvColumns,
} from "@/hooks/use-data";
import type { CsvUploadResponse, CsvUploadStatus } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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

function StatusBadge({ status }: { status: CsvUploadStatus }) {
  const config: Record<CsvUploadStatus, { variant: "default" | "destructive" | "secondary" | "outline"; icon?: React.ReactNode }> = {
    completed: { variant: "default", icon: <CheckCircle2 className="size-3" /> },
    failed: { variant: "destructive", icon: <XCircle className="size-3" /> },
    processing: { variant: "secondary", icon: <Loader2 className="size-3 animate-spin" /> },
    uploaded: { variant: "outline" },
    mapping: { variant: "outline" },
  };
  const c = config[status];

  return (
    <Badge variant={c.variant}>
      {c.icon}
      {status}
    </Badge>
  );
}

const NONE_VALUE = "__none__";

export default function CsvUploadPage() {
  const { data: uploads, isLoading: uploadsLoading } = useCsvUploads();
  const uploadCsv = useUploadCsv();

  const [isDragging, setIsDragging] = useState(false);
  const [uploadResponse, setUploadResponse] =
    useState<CsvUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state
  const [timestampCol, setTimestampCol] = useState("");
  const [eventTypeCol, setEventTypeCol] = useState("");
  const [actorIdCol, setActorIdCol] = useState("");
  const [numericValueCol, setNumericValueCol] = useState("");

  const mapColumns = useMapCsvColumns(uploadResponse?.id ?? "");

  const resetMapping = useCallback(() => {
    setTimestampCol("");
    setEventTypeCol("");
    setActorIdCol("");
    setNumericValueCol("");
    setUploadResponse(null);
  }, []);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    try {
      const result = await uploadCsv.mutateAsync(file);
      setUploadResponse(result);
      toast.success(`Uploaded "${result.filename}" successfully`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to upload file";
      toast.error(message);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  async function handleSubmitMapping() {
    if (!timestampCol || !eventTypeCol) {
      toast.error("Timestamp and Event Type mappings are required");
      return;
    }

    // Build remaining columns as properties
    const allColumns = uploadResponse?.columns ?? [];
    const mappedCols = new Set(
      [timestampCol, eventTypeCol, actorIdCol, numericValueCol].filter(Boolean)
    );
    const properties: Record<string, string> = {};
    for (const col of allColumns) {
      if (!mappedCols.has(col)) {
        properties[col] = col;
      }
    }

    try {
      await mapColumns.mutateAsync({
        mapping: {
          timestamp: timestampCol,
          event_type: eventTypeCol,
          actor_id: actorIdCol || undefined,
          numeric_value: numericValueCol || undefined,
          properties,
        },
      });
      toast.success("Column mapping submitted. Processing will begin shortly.");
      resetMapping();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to submit mapping";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CSV Upload</h1>
        <p className="text-sm text-muted-foreground">
          Upload CSV files to import events in bulk
        </p>
      </div>

      {/* Upload zone */}
      {!uploadResponse && (
        <Card>
          <CardContent className="pt-6">
            <div
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              } ${uploadCsv.isPending ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
              {uploadCsv.isPending ? (
                <>
                  <Loader2 className="size-10 animate-spin text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">Uploading...</p>
                  <p className="text-xs text-muted-foreground">
                    Please wait while your file is being uploaded
                  </p>
                </>
              ) : (
                <>
                  <Upload className="size-10 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">
                    Drag and drop your CSV file here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse files
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column preview + mapping */}
      {uploadResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              {uploadResponse.filename}
            </CardTitle>
            <CardDescription>
              {formatBytes(uploadResponse.file_size_bytes)} &middot;{" "}
              {uploadResponse.row_count?.toLocaleString() ?? "?"} rows &middot;{" "}
              {uploadResponse.columns.length} columns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview table */}
            <div>
              <h3 className="mb-2 text-sm font-medium">Data Preview</h3>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {uploadResponse.columns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResponse.preview_rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="max-w-[200px] truncate">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Column mapping form */}
            <div>
              <h3 className="mb-3 text-sm font-medium">Column Mapping</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Map your CSV columns to event fields. Timestamp and Event Type
                are required.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Timestamp <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={timestampCol}
                    onValueChange={(v) => v && setTimestampCol(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {uploadResponse.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Event Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={eventTypeCol}
                    onValueChange={(v) => v && setEventTypeCol(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {uploadResponse.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Actor ID</Label>
                  <Select
                    value={actorIdCol || NONE_VALUE}
                    onValueChange={(v) =>
                      setActorIdCol(v === NONE_VALUE ? "" : (v ?? ""))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {uploadResponse.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Numeric Value</Label>
                  <Select
                    value={numericValueCol || NONE_VALUE}
                    onValueChange={(v) =>
                      setNumericValueCol(v === NONE_VALUE ? "" : (v ?? ""))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {uploadResponse.columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleSubmitMapping}
                  disabled={mapColumns.isPending}
                >
                  {mapColumns.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Mapping"
                  )}
                </Button>
                <Button variant="outline" onClick={resetMapping}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Past uploads */}
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>All CSV files uploaded to your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !uploads || uploads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileSpreadsheet className="size-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No uploads yet
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
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
                    <TableCell>
                      {upload.success_count?.toLocaleString() ?? "-"}
                    </TableCell>
                    <TableCell>
                      {upload.error_count != null && upload.error_count > 0 ? (
                        <span className="text-destructive">
                          {upload.error_count.toLocaleString()}
                        </span>
                      ) : (
                        upload.error_count?.toLocaleString() ?? "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(upload.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {upload.completed_at
                        ? formatDate(upload.completed_at)
                        : "-"}
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
