import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/utils/cn";

import { EmptyState } from "./misc";
import { Skeleton } from "./Spinner";

/** Registros por página en todos los listados (igual al PAGE_SIZE del backend). */
export const PAGE_SIZE = 20;

/** Pagina en el cliente una lista completa; si la lista se achica, la página se ajusta sola. */
export function usePaged<T>(items: T[], pageSize = PAGE_SIZE) {
  const [requested, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requested, pages);
  return { page, setPage, count: items.length, rows: items.slice((page - 1) * pageSize, page * pageSize) };
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
}

/** Tabla de datos. Con `paginate` recibe la lista completa y la muestra de 20 en 20 (paginado en el cliente). */
export function DataTable<T extends { id: number | string }>({ paginate, ...props }: DataTableProps<T> & { paginate?: boolean }) {
  return paginate ? <PagedTable {...props} /> : <Table {...props} />;
}

interface DataTableProps<T> {
  columns: Column<T>[]; rows: T[]; loading?: boolean; onRowClick?: (row: T) => void; empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

function PagedTable<T extends { id: number | string }>({ rows, ...props }: DataTableProps<T>) {
  const paged = usePaged(rows);
  return (
    <>
      {paged.count > PAGE_SIZE && <Pagination page={paged.page} count={paged.count} onChange={paged.setPage} position="top" />}
      <Table rows={paged.rows} {...props} />
      {!props.loading && paged.count > 0 && <Pagination page={paged.page} count={paged.count} onChange={paged.setPage} />}
    </>
  );
}

function Table<T extends { id: number | string }>({ columns, rows, loading, onRowClick, empty, rowClassName }: DataTableProps<T>) {
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

/** Páginas visibles alrededor de la actual (con «…» entre saltos). */
function pageWindow(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i && p - sorted[i - 1] > 1 ? ["…" as const, p] : [p]));
}

/**
 * Paginación con el total de registros. Úsela arriba (`position="top"`) y abajo de cada listado:
 * siempre muestra cuántos elementos hay; los controles aparecen si hay más de una página.
 */
export function Pagination({ page, count, pageSize = PAGE_SIZE, onChange, position = "bottom" }: {
  page: number; count: number; pageSize?: number; onChange: (p: number) => void; position?: "top" | "bottom";
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const from = count ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, count);
  const fmt = (n: number) => n.toLocaleString("es");
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm dark:border-white/5",
      position === "top" ? "border-b border-slate-100" : "border-t border-slate-100")}>
      <span className="text-slate-500">
        {!count ? "Sin registros" : pages > 1 ? <>Mostrando <b>{fmt(from)}–{fmt(to)}</b> de <b>{fmt(count)}</b> registros</> : <><b>{fmt(count)}</b> registro{count === 1 ? "" : "s"}</>}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(1)} aria-label="Primera página"><ChevronsLeft className="h-4 w-4" /></button>
          <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
          {pageWindow(page, pages).map((p, i) => p === "…"
            ? <span key={`gap${i}`} className="px-1 text-slate-400">…</span>
            : <button key={p} onClick={() => onChange(p)} aria-current={p === page ? "page" : undefined}
                className={cn("btn-sm min-w-8 tabular-nums", p === page ? "btn-primary" : "btn-ghost")}>{p}</button>)}
          <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
          <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(pages)} aria-label="Última página"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
