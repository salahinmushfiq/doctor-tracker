'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiData } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { ConditionDistribution, DoctorStatistics, Overview, RecentActivity, Trends } from '@/types/api';

export interface RangeParams extends Record<string, string | undefined> {
  startDate?: string;
  endDate?: string;
}

/** Every widget receives the same window, so the numbers on the page always agree. */
const opts = { placeholderData: keepPreviousData, staleTime: 30_000 } as const;

export function useOverview(p: RangeParams) {
  return useQuery({ queryKey: qk.dashboard.overview(p), queryFn: ({ signal }) => apiData<Overview>('/dashboard/overview', { query: p, signal }), ...opts });
}
export function useTrends(p: RangeParams) {
  return useQuery({ queryKey: qk.dashboard.trends(p), queryFn: ({ signal }) => apiData<Trends>('/dashboard/trends', { query: p, signal }), ...opts });
}
export function useDoctorStatistics(p: RangeParams) {
  const query = { ...p, limit: 10 };
  return useQuery({ queryKey: qk.dashboard.doctorStats(query), queryFn: ({ signal }) => apiData<DoctorStatistics>('/dashboard/doctor-statistics', { query, signal }), ...opts });
}
export function useConditionDistribution(p: RangeParams) {
  return useQuery({ queryKey: qk.dashboard.conditions(p), queryFn: ({ signal }) => apiData<ConditionDistribution>('/dashboard/condition-distribution', { query: p, signal }), ...opts });
}
export function useRecentActivity() {
  return useQuery({ queryKey: qk.dashboard.recent, queryFn: ({ signal }) => apiData<RecentActivity>('/dashboard/recent-activity', { signal }), staleTime: 15_000 });
}
