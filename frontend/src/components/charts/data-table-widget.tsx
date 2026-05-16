"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TableData } from "@/types/api";

interface DataTableWidgetProps {
  data: TableData;
}

function formatColumnHeader(column: string): string {
  const name = column.includes(".")
    ? column.split(".").pop() ?? column
    : column;
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCellValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function DataTableWidget({ data }: DataTableWidgetProps) {
  if (data.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50">
            {data.columns.map((column) => (
              <TableHead
                key={column}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {formatColumnHeader(column)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={data.columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          ) : (
            data.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="border-b border-border/30">
                {data.columns.map((column) => (
                  <TableCell key={column} className="py-2 text-sm">
                    {formatCellValue(row[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
