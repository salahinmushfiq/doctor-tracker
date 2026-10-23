'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { cn, fmtNumber } from '@/lib/utils';
import type { ConditionDistribution, DoctorStatistics, Trends } from '@/types/api';

/* Series colours validated with the dataviz skill (decisions D24). Text never uses these. */
export const COLORS = { patients: '#2a78d6', doctors: '#eb6834' } as const;
const GRID = '#e6ebf0';
const AXIS = '#506178';
const TICK = { fontSize: 12, fill: AXIS };

/** Chart card with a keyboard-accessible "view as table" alternative, loading/error/empty states and a dimmed refetch. */
export function ChartCard({
  id,
  title,
  description,
  loading,
  refreshing,
  error,
  onRetry,
  empty,
  emptyText,
  chart,
  table,
  legend,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  loading: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: boolean;
  emptyText: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  legend?: React.ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <Card className={className}>
      <CardHeader
        id={id}
        title={title}
        description={description}
        action={
          !loading && !empty && !error ? (
            <Button variant="ghost" size="sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
              {asTable ? <BarChart3 className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
              {asTable ? 'View as chart' : 'View as table'}
            </Button>
          ) : undefined
        }
      />
      <div className="p-5" role="region" aria-labelledby={id}>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : empty ? (
          <EmptyState title="Nothing to chart yet" description={emptyText} />
        ) : (
          <div aria-busy={refreshing || undefined} className={cn('transition-opacity', refreshing && 'opacity-60')}>
            {legend}
            {asTable ? <div className="max-h-80 overflow-auto">{table}</div> : chart}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: i.color, height: 3 }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string; color?: string }>;
  label?: string | number;
  formatLabel?: (l: string | number) => string;
}

/** Values lead (strong), names follow (muted); series keyed by a short line, never a box. Text uses ink tokens. */
function Tip({ active, payload, label, formatLabel }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      {label !== undefined && <p className="mb-1 text-xs text-ink-muted">{formatLabel ? formatLabel(label) : label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.name)} className="flex items-center gap-2 text-[13px]">
            <span aria-hidden className="inline-block w-3 rounded" style={{ background: p.color, height: 3 }} />
            <span className="tabular font-semibold text-ink">{fmtNumber(Number(p.value ?? 0))}</span>
            <span className="text-ink-muted">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function bucketLabel(bucket: string, interval: Trends['interval']) {
  const [y, m, d] = bucket.split('-').map(Number) as [number, number, number];
  const mon = MONTHS[m - 1];
  if (interval === 'month') return `${mon} ${y}`;
  if (interval === 'week') return `Week of ${d} ${mon}`;
  return `${d} ${mon}`;
}
const shortBucket = (bucket: string, interval: Trends['interval']) => (interval === 'month' ? bucketLabel(bucket, interval).replace(/ \d{4}$/, (m) => ` '${m.slice(3)}`) : bucketLabel(bucket, 'day'));

function DataTable2({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-surface-muted text-[13px] text-ink-muted">
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={cn('px-3 py-2 font-medium', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-line">
            {r.map((c, j) => (
              <td key={j} className={cn('tabular px-3 py-2', j > 0 && 'text-right')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrendChart({ trends, loading, refreshing, error, onRetry }: { trends?: Trends; loading: boolean; refreshing: boolean; error?: string | null; onRetry: () => void }) {
  const series = trends?.series ?? [];
  const interval = trends?.interval ?? 'day';
  const unit = interval === 'day' ? 'day' : interval === 'week' ? 'week' : 'month';
  return (
    <ChartCard
      id="chart-trend"
      title="New doctors and patients over time"
      description={`Records created per ${unit} (UTC). Empty periods count as zero.`}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      empty={!trends?.hasData}
      emptyText="No doctors or patients were added in this period. Try a longer period."
      legend={<Legend items={[{ label: 'Patients', color: COLORS.patients }, { label: 'Doctors', color: COLORS.doctors }]} />}
      chart={
        <div className="h-72 w-full" role="img" aria-label={`Line chart of new patients and doctors per ${unit}. Use "View as table" for exact values.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="bucket" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(b: string) => shortBucket(b, interval)} minTickGap={24} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip content={<Tip formatLabel={(l) => bucketLabel(String(l), interval)} />} cursor={{ stroke: AXIS, strokeWidth: 1 }} />
              <Line type="monotone" dataKey="patients" name="Patients" stroke={COLORS.patients} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="doctors" name="Doctors" stroke={COLORS.doctors} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={<DataTable2 head={['Period', 'Patients', 'Doctors']} rows={series.map((p) => [bucketLabel(p.bucket, interval), p.patients, p.doctors])} />}
    />
  );
}

export function SpecializationChart({ stats, loading, refreshing, error, onRetry }: { stats?: DoctorStatistics; loading: boolean; refreshing: boolean; error?: string | null; onRetry: () => void }) {
  const rows = (stats?.specializations ?? []).slice(0, 8);
  return (
    <ChartCard
      id="chart-spec"
      title="Doctors vs patients by specialization"
      description="Doctors added and patients registered in the period, grouped by specialization (top 8)."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      empty={rows.length === 0}
      emptyText="No doctors or patients were added in this period."
      legend={<Legend items={[{ label: 'Patients', color: COLORS.patients }, { label: 'Doctors', color: COLORS.doctors }]} />}
      chart={
        <div className="h-72 w-full" role="img" aria-label="Bar chart comparing doctors and patients per specialization. Use &quot;View as table&quot; for exact values.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="specialization" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} interval={0} tickFormatter={(s: string) => (s.length > 11 ? `${s.slice(0, 10)}…` : s)} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip content={<Tip />} cursor={{ fill: '#eef2f6' }} />
              <Bar dataKey="patients" name="Patients" fill={COLORS.patients} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="doctors" name="Doctors" fill={COLORS.doctors} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<DataTable2 head={['Specialization', 'Patients', 'Doctors']} rows={(stats?.specializations ?? []).map((r) => [r.specialization, r.patients, r.doctors])} />}
    />
  );
}

export function ConditionChart({ data, loading, refreshing, error, onRetry }: { data?: ConditionDistribution; loading: boolean; refreshing: boolean; error?: string | null; onRetry: () => void }) {
  const items = data?.items ?? [];
  return (
    <ChartCard
      id="chart-condition"
      title="Patients by condition"
      description={data ? `${fmtNumber(data.total)} patients registered in the period.` : undefined}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      empty={items.length === 0}
      emptyText="No patients were added in this period."
      chart={
        <div className="w-full" style={{ height: Math.max(180, items.length * 30 + 24) }} role="img" aria-label="Horizontal bar chart of patients per condition category. Use &quot;View as table&quot; for exact values.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="condition" tick={TICK} tickLine={false} axisLine={false} width={150} interval={0} />
              <Tooltip content={<Tip />} cursor={{ fill: '#eef2f6' }} />
              <Bar dataKey="count" name="Patients" fill={COLORS.patients} maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: '#0f1b2d' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={<DataTable2 head={['Condition', 'Patients', 'Share']} rows={items.map((i) => [i.condition, i.count, `${i.percentage}%`])} />}
    />
  );
}
