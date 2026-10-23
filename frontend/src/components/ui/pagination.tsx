import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { Pagination as PaginationData } from '@/types/api';
import { fmtNumber } from '@/lib/utils';
import { Button } from './button';
import { Select } from './field';

const PAGE_SIZES = [10, 25, 50];

export function Pagination({
  pagination,
  onPageChange,
  onLimitChange,
  disabled,
}: {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  disabled?: boolean;
}) {
  const { page, limit, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p role="status" aria-live="polite" className="tabular text-[13px] text-ink-muted">
        {total === 0 ? 'No results' : `Showing ${fmtNumber(from)}-${fmtNumber(to)} of ${fmtNumber(total)}`}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          Rows
          <Select aria-label="Rows per page" className="h-8 w-[4.5rem] text-[13px]" value={limit} disabled={disabled} onChange={(e) => onLimitChange(Number(e.target.value))}>
            {[...new Set([...PAGE_SIZES, limit])].sort((a, b) => a - b).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <span className="tabular text-[13px] text-ink-muted">
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </span>
        <div className="flex gap-1">
          <Button variant="secondary" size="icon" className="h-8 w-8" aria-label="First page" disabled={disabled || atStart} onClick={() => onPageChange(1)}>
            <ChevronsLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8" aria-label="Previous page" disabled={disabled || atStart} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8" aria-label="Next page" disabled={disabled || atEnd} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" className="h-8 w-8" aria-label="Last page" disabled={disabled || atEnd} onClick={() => onPageChange(totalPages)}>
            <ChevronsRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
