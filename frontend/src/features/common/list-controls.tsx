'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn, formatDate } from '@/lib/utils';

/**
 * Search box that stays responsive while typing: the text is local state, and only the debounced value is written to the
 * URL (which drives the server query). External changes (Reset, back button) flow back in without clobbering typing.
 */
export function SearchInput({ value, onCommit, label = 'Search', placeholder, delayMs = 300 }: { value: string; onCommit: (v: string) => void; label?: string; placeholder?: string; delayMs?: number }) {
  const [text, setText] = React.useState(value);
  const committed = React.useRef(value);
  const debounced = useDebouncedValue(text.trim(), delayMs);

  React.useEffect(() => {
    if (debounced !== committed.current) {
      committed.current = debounced;
      onCommit(debounced);
    }
  }, [debounced, onCommit]);

  React.useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  return (
    <div className="relative">
      <label htmlFor="list-search" className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <Input id="list-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={100} className="pl-9" autoComplete="off" />
    </div>
  );
}

export function DateRangeFields({ start, end, onChange }: { start: string; end: string; onChange: (patch: { startDate?: string; endDate?: string }) => void }) {
  const invalid = Boolean(start && end && start > end);
  return (
    <>
      <Field id="filter-start" label="Added from" error={invalid ? 'Start must be on or before the end date' : undefined}>
        {(p) => <Input {...p} type="date" value={start} max={end || undefined} onChange={(e) => onChange({ startDate: e.target.value })} />}
      </Field>
      <Field id="filter-end" label="Added to">
        {(p) => <Input {...p} type="date" value={end} min={start || undefined} onChange={(e) => onChange({ endDate: e.target.value })} />}
      </Field>
    </>
  );
}

export interface FilterChip {
  key: string;
  label: string;
  value: string;
}

export function ActiveFilters({ chips, onRemove, onReset }: { chips: FilterChip[]; onRemove: (key: string) => void; onReset: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-xs font-medium text-accent-hover">
          {c.label}: {c.value}
          <button type="button" onClick={() => onRemove(c.key)} className="rounded-full p-1 hover:bg-accent/15" aria-label={`Remove filter ${c.label}: ${c.value}`}>
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button variant="link" size="sm" onClick={onReset} className="text-[13px]">
        Reset all
      </Button>
    </div>
  );
}

/** Builds the chip list for the filters that are set. Dates are shown formatted. */
export function buildChips(filters: Record<string, string>, labels: Record<string, string>): FilterChip[] {
  return Object.entries(labels)
    .filter(([key]) => filters[key])
    .map(([key, label]) => ({ key, label, value: key.endsWith('Date') ? formatDate(`${filters[key]}T00:00:00Z`) : (filters[key] as string) }));
}

export function FilterGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>{children}</div>;
}
