'use client';

import * as React from 'react';
import Link from 'next/link';
import { Stethoscope, UserX, Users, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { describeError } from '@/lib/api-client';
import { fmtNumber, formatDate } from '@/lib/utils';
import { ConditionChart, SpecializationChart, TrendChart } from './charts';
import { DateRangeSelector, useDashboardRange } from './date-range';
import { useConditionDistribution, useDoctorStatistics, useOverview, useRecentActivity, useTrends } from './hooks';

function MetricCard({ label, value, hint, icon, loading, refreshing }: { label: string; value?: string; hint?: string; icon: React.ReactNode; loading: boolean; refreshing?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-hover" aria-hidden>
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <p className={`tabular mt-2 text-3xl font-semibold tracking-tight transition-opacity ${refreshing ? 'opacity-60' : ''}`}>{value}</p>
      )}
      {hint && !loading && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

export function DashboardPage() {
  const range = useDashboardRange();
  const { params, invalid } = range;
  const overview = useOverview(params);
  const trends = useTrends(params);
  const stats = useDoctorStatistics(params);
  const conditions = useConditionDistribution(params);
  const recent = useRecentActivity();

  const ov = overview.data;
  const period = range.preset === 'all' ? 'all time' : 'selected period';
  const periodHint = (n?: number) => (n === undefined ? undefined : `+${fmtNumber(n)} in ${period}`);
  const refreshing = (q: { isFetching: boolean; isPlaceholderData: boolean }) => q.isFetching && q.isPlaceholderData;
  const err = (q: { error: unknown }) => (q.error ? describeError(q.error) : null);

  return (
    <>
      <PageHeader title="Dashboard" description="Live figures from the database. The period applies to the charts, rankings and “new” counts below." />
      <div className="mb-6">
        <DateRangeSelector range={range} />
      </div>

      {overview.error && !ov ? (
        <Card className="mb-6">
          <ErrorState message={describeError(overview.error)} onRetry={() => void overview.refetch()} />
        </Card>
      ) : (
        <section aria-label="Key figures" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total doctors" value={fmtNumber(ov?.totals.doctors ?? 0)} hint={periodHint(ov?.inRange.doctors)} icon={<Stethoscope className="h-4 w-4" />} loading={overview.isPending} refreshing={refreshing(overview)} />
          <MetricCard label="Total patients" value={fmtNumber(ov?.totals.patients ?? 0)} hint={periodHint(ov?.inRange.patients)} icon={<Users className="h-4 w-4" />} loading={overview.isPending} refreshing={refreshing(overview)} />
          <MetricCard label="Patients per doctor" value={String(ov?.averagePatientsPerDoctor ?? 0)} hint="Average across all doctors (assigned patients)" icon={<UsersRound className="h-4 w-4" />} loading={overview.isPending} refreshing={refreshing(overview)} />
          <MetricCard label="Unassigned patients" value={fmtNumber(ov?.totals.unassignedPatients ?? 0)} hint="Patients without a doctor" icon={<UserX className="h-4 w-4" />} loading={overview.isPending} refreshing={refreshing(overview)} />
        </section>
      )}

      {invalid ? (
        <Card>
          <EmptyState title="Check the date range" description="The start date must be on or before the end date." />
        </Card>
      ) : (
        <div className="grid gap-6">
          <TrendChart trends={trends.data} loading={trends.isPending} refreshing={refreshing(trends)} error={err(trends)} onRetry={() => void trends.refetch()} />
          <div className="grid gap-6 xl:grid-cols-2">
            <SpecializationChart stats={stats.data} loading={stats.isPending} refreshing={refreshing(stats)} error={err(stats)} onRetry={() => void stats.refetch()} />
            <ConditionChart data={conditions.data} loading={conditions.isPending} refreshing={refreshing(conditions)} error={err(conditions)} onRetry={() => void conditions.refetch()} />
          </div>

          <Card>
            <CardHeader title="Doctors ranked by patients" description="Top 10 by patients registered in the period." />
            {stats.isPending ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5" />
                ))}
              </div>
            ) : stats.error && !stats.data ? (
              <ErrorState message={describeError(stats.error)} onRetry={() => void stats.refetch()} />
            ) : stats.data && stats.data.topDoctors.length === 0 ? (
              <EmptyState title="No assigned patients in this period" description="Assign patients to doctors to see the ranking." />
            ) : (
              <div className={`overflow-x-auto transition-opacity ${refreshing(stats) ? 'opacity-60' : ''}`}>
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Doctors ranked by number of patients</caption>
                  <thead className="bg-surface-muted text-[13px] text-ink-muted">
                    <tr>
                      <th scope="col" className="w-14 px-5 py-2.5 font-medium">#</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Doctor</th>
                      <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Specialization</th>
                      <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Hospital</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Patients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data?.topDoctors.map((d, i) => (
                      <tr key={d.doctorId} className="border-t border-line">
                        <td className="tabular px-5 py-3 text-ink-muted">{i + 1}</td>
                        <td className="px-3 py-3">
                          <Link href={`/doctors/${d.doctorId}`} className="font-medium hover:text-accent hover:underline">
                            {d.fullName}
                          </Link>
                        </td>
                        <td className="hidden px-3 py-3 sm:table-cell"><Badge tone="accent">{d.specialization}</Badge></td>
                        <td className="hidden px-3 py-3 text-ink-muted md:table-cell">{d.hospital}</td>
                        <td className="tabular px-5 py-3 text-right font-semibold">{fmtNumber(d.patients)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <section aria-label="Recent activity" className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recently added doctors" description="Latest records, regardless of period." />
              {recent.isPending ? (
                <div className="space-y-3 p-5"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
              ) : recent.error ? (
                <ErrorState message={describeError(recent.error)} onRetry={() => void recent.refetch()} />
              ) : recent.data?.doctors.length === 0 ? (
                <EmptyState title="No doctors yet" />
              ) : (
                <ul className="divide-y divide-line">
                  {recent.data?.doctors.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <Link href={`/doctors/${d.id}`} className="min-w-0">
                        <span className="block truncate font-medium hover:text-accent hover:underline">{d.fullName}</span>
                        <span className="block truncate text-[13px] text-ink-muted">{d.specialization} · {d.hospital}</span>
                      </Link>
                      <span className="shrink-0 text-xs text-ink-muted">{formatDate(d.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Recently added patients" description="Latest records, regardless of period." />
              {recent.isPending ? (
                <div className="space-y-3 p-5"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
              ) : recent.error ? (
                <ErrorState message={describeError(recent.error)} onRetry={() => void recent.refetch()} />
              ) : recent.data?.patients.length === 0 ? (
                <EmptyState title="No patients yet" />
              ) : (
                <ul className="divide-y divide-line">
                  {recent.data?.patients.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <Link href={`/patients/${p.id}`} className="min-w-0">
                        <span className="block truncate font-medium hover:text-accent hover:underline">{p.fullName}</span>
                        <span className="block truncate text-[13px] text-ink-muted">{p.condition} · {p.doctor?.fullName ?? 'Unassigned'}</span>
                      </Link>
                      <span className="shrink-0 text-xs text-ink-muted">{formatDate(p.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
