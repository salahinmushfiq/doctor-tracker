'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Field, Input } from '@/components/ui/field';
import { cn, utcDay } from '@/lib/utils';
import type { RangeParams } from './hooks';

export const PRESETS = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: '12m', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'All time', days: null },
  { id: 'custom', label: 'Custom', days: null },
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];

/** Window as API params. Presets are inclusive of today (UTC), e.g. "7d" = today and the 6 days before. */
export function rangeFor(preset: PresetId, custom: { startDate?: string; endDate?: string }, now: Date = new Date()): RangeParams {
  if (preset === 'custom') return { startDate: custom.startDate || undefined, endDate: custom.endDate || undefined };
  const p = PRESETS.find((x) => x.id === preset);
  if (!p || p.days === null) return {};
  return { startDate: utcDay(-(p.days - 1), now), endDate: utcDay(0, now) };
}

export function useDashboardRange() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = sp.get('range');
  const preset: PresetId = PRESETS.some((p) => p.id === raw) ? (raw as PresetId) : '30d';
  const startDate = sp.get('startDate') ?? '';
  const endDate = sp.get('endDate') ?? '';
  const invalid = preset === 'custom' && Boolean(startDate && endDate && startDate > endDate);

  const params = React.useMemo<RangeParams>(() => (invalid ? {} : rangeFor(preset, { startDate, endDate })), [preset, startDate, endDate, invalid]);

  const push = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, pathname, router],
  );

  return {
    preset,
    startDate,
    endDate,
    invalid,
    params,
    setPreset: (id: PresetId) => push({ range: id === '30d' ? null : id, ...(id === 'custom' ? {} : { startDate: null, endDate: null }) }),
    setCustom: (patch: { startDate?: string; endDate?: string }) => push({ range: 'custom', ...patch }),
  };
}

export function DateRangeSelector({ range }: { range: ReturnType<typeof useDashboardRange> }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3" role="group" aria-label="Reporting period">
      <div>
        <p id="range-label" className="mb-1.5 text-[13px] font-medium text-ink">
          Period
        </p>
        <div role="radiogroup" aria-labelledby="range-label" className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={range.preset === p.id}
              onClick={() => range.setPreset(p.id)}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors', range.preset === p.id ? 'bg-accent text-white' : 'text-ink-muted hover:bg-surface-muted hover:text-ink')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {range.preset === 'custom' && (
        <div className="flex flex-wrap items-start gap-3">
          <Field id="dash-start" label="From" error={range.invalid ? 'Start must be on or before the end date' : undefined}>
            {(p) => <Input {...p} type="date" className="w-44" value={range.startDate} max={range.endDate || undefined} onChange={(e) => range.setCustom({ startDate: e.target.value })} />}
          </Field>
          <Field id="dash-end" label="To">
            {(p) => <Input {...p} type="date" className="w-44" value={range.endDate} min={range.startDate || undefined} onChange={(e) => range.setCustom({ endDate: e.target.value })} />}
          </Field>
        </div>
      )}
    </div>
  );
}
