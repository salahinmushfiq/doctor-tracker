import { addDays, daysBetween, startOfUtcDay, type DateRange } from './dates';
import type { TrendInterval } from '../validators/dashboard';

export const MAX_BUCKETS = 400;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Start of the bucket containing `d` (UTC; weeks start on Monday, matching $dateTrunc startOfWeek). */
export function truncate(d: Date, unit: TrendInterval): Date {
  const day = startOfUtcDay(d);
  if (unit === 'day') return day;
  if (unit === 'week') {
    const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
    return addDays(day, -dow);
  }
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function next(bucket: Date, unit: TrendInterval): Date {
  if (unit === 'day') return addDays(bucket, 1);
  if (unit === 'week') return addDays(bucket, 7);
  return new Date(Date.UTC(bucket.getUTCFullYear(), bucket.getUTCMonth() + 1, 1));
}

export function countBuckets(from: Date, to: Date, unit: TrendInterval): number {
  let n = 0;
  for (let b = truncate(from, unit); b < to && n <= MAX_BUCKETS + 1; b = next(b, unit)) n++;
  return n;
}

/** Pick a readable granularity: ≤31 days → day, ≤180 days → week, else month. Honors a requested one if it stays bounded. */
export function chooseInterval(from: Date, to: Date, requested?: TrendInterval): TrendInterval {
  if (requested && countBuckets(from, to, requested) <= MAX_BUCKETS) return requested;
  const days = daysBetween(from, to);
  return days <= 31 ? 'day' : days <= 180 ? 'week' : 'month';
}

export interface Point {
  bucket: string; // YYYY-MM-DD (bucket start)
  doctors: number;
  patients: number;
}

/**
 * Merge the two sparse aggregation results into one dense series.
 * Zero-filling matters: a gap in the data must render as 0, not as a line jumping across missing days.
 */
export function buildSeries(
  range: Required<Pick<DateRange, 'from' | 'to'>>,
  unit: TrendInterval,
  doctorRows: Array<{ _id: Date; count: number }>,
  patientRows: Array<{ _id: Date; count: number }>,
): Point[] {
  const d = new Map(doctorRows.map((r) => [iso(truncate(r._id, unit)), r.count]));
  const p = new Map(patientRows.map((r) => [iso(truncate(r._id, unit)), r.count]));
  const points: Point[] = [];
  for (let b = truncate(range.from, unit); b < range.to; b = next(b, unit)) {
    const key = iso(b);
    points.push({ bucket: key, doctors: d.get(key) ?? 0, patients: p.get(key) ?? 0 });
  }
  return points;
}
