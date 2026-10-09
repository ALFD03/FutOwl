import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/utils/cn";

import { EmptyState } from "./misc";
import { Skeleton } from "./Spinner";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: number | string }>({ columns, rows, loading, onRowClick, empty, rowClassName }: {
  columns: Column<T>[]; rows: T[]; loading?: boolean; onRowClick?: (row: T) => void; empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.className}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <tr key={`s${i}`}>{columns.map((c) => <td key={c.key}><Skeleton /></td>)}</tr>
          ))}
          {!loading && rows.map((row) => (
            <tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer", rowClassName?.(row))}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (empty ?? <EmptyState />)}
    </div>
  );
}

export function Pagination({ page, count, pageSize = 25, onChange }: { page: number; count: number; pageSize?: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm dark:border-white/5">
      <span className="text-slate-500">{count} registros · página {page} de {pages}</span>
      <div className="flex gap-1">
        <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
        <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
