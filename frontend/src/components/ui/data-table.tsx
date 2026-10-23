import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortOrder } from '@/types/api';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { ErrorState } from './states';

export interface Column<T> {
  key: string;
  header: string;
  /** API sortBy value; omit for non-sortable columns. */
  sortKey?: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Visually hide the header (e.g. the actions column) while keeping it for screen readers. */
  srOnlyHeader?: boolean;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  /** Mobile (<768px) layout: a card per row instead of a squeezed table. */
  renderCard: (row: T) => React.ReactNode;
  loading?: boolean;
  /** true while refetching with previous rows still shown */
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: React.ReactNode;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSort?: (sortKey: string) => void;
  skeletonRows?: number;
}

export function DataTable<T>({ caption, columns, rows, rowKey, renderCard, loading, refreshing, error, onRetry, empty, sortBy, sortOrder, onSort, skeletonRows = 6 }: DataTableProps<T>) {
  if (error && !rows?.length) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !rows) {
    return (
      <div aria-busy="true" aria-label={`Loading ${caption}`}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="hidden h-4 w-1/5 md:block" />
            <Skeleton className="hidden h-4 w-1/4 md:block" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }
  if (rows && rows.length === 0) return <>{empty}</>;
  if (!rows) return null;

  return (
    <div aria-busy={refreshing || undefined} className={cn('transition-opacity', refreshing && 'opacity-60')}>
      {error && <p role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-[13px] text-danger">Could not refresh: {error}</p>}

      {/* ≥768px: real table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-surface-muted text-[13px] text-ink-muted">
              {columns.map((c) => {
                const active = c.sortKey !== undefined && c.sortKey === sortBy;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={c.sortKey ? (active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                    className={cn('px-4 py-2.5 font-medium whitespace-nowrap', c.className)}
                  >
                    {c.sortKey && onSort ? (
                      <button type="button" onClick={() => onSort(c.sortKey!)} className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-ink">
                        {c.header}
                        {active ? sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />}
                        <span className="sr-only">{active ? `, sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : ', click to sort'}</span>
                      </button>
                    ) : c.srOnlyHeader ? (
                      <span className="sr-only">{c.header}</span>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line hover:bg-surface-muted/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* <768px: card list */}
      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="p-4">
            {renderCard(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
