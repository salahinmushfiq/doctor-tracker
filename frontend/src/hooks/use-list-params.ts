'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SortOrder } from '@/types/api';

type Patch = Record<string, string | number | null | undefined>;

const clampInt = (raw: string | null, fallback: number, min: number, max: number) => {
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  return Math.min(max, Math.max(min, Number(raw)));
};

interface Options {
  defaultSortBy: string;
  defaultSortOrder: SortOrder;
  /** allow-list: anything else in the URL falls back to the default */
  sortKeys: readonly string[];
  /** URL keys that act as filters (search, specialization, startDate...) */
  filterKeys: readonly string[];
  defaultLimit?: number;
}

/**
 * The URL is the single source of truth for list state (page, size, sort, search, filters), so a
 * refresh, the back button, or a shared link restores exactly the same view.
 * Changing anything except the page resets to page 1.
 */
export function useListParams({ defaultSortBy, defaultSortOrder, sortKeys, filterKeys, defaultLimit = 10 }: Options) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const spString = sp.toString();

  const page = clampInt(sp.get('page'), 1, 1, 100_000);
  const limit = clampInt(sp.get('limit'), defaultLimit, 1, 100);
  const rawSortBy = sp.get('sortBy');
  const sortBy = rawSortBy && sortKeys.includes(rawSortBy) ? rawSortBy : defaultSortBy;
  const rawOrder = sp.get('sortOrder');
  const sortOrder: SortOrder = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaultSortOrder;

  const filters = React.useMemo(() => {
    const out: Record<string, string> = {};
    const params = new URLSearchParams(spString);
    for (const k of filterKeys) {
      const v = params.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [spString, filterKeys]);

  const update = React.useCallback(
    (patch: Patch) => {
      const next = new URLSearchParams(spString);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      if (!('page' in patch)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [spString, pathname, router],
  );

  /** Clears search, filters, dates and page; keeps the chosen sort and page size. */
  const reset = React.useCallback(() => update(Object.fromEntries([...filterKeys, 'page'].map((k) => [k, null]))), [update, filterKeys]);

  const setSort = React.useCallback(
    (key: string) => update({ sortBy: key, sortOrder: key === sortBy && sortOrder === 'asc' ? 'desc' : 'asc' }),
    [update, sortBy, sortOrder],
  );

  /** Params for the API call. */
  const query = React.useMemo(() => ({ page, limit, sortBy, sortOrder, ...filters }), [page, limit, sortBy, sortOrder, filters]);

  return { page, limit, sortBy, sortOrder, filters, query, update, reset, setSort, activeFilterCount: Object.keys(filters).length };
}
