/**
 * Date-range semantics (documented in docs/architecture.md):
 *  - All ranges apply to the record's `createdAt`.
 *  - `startDate` is inclusive, `endDate` is inclusive of the whole calendar day (UTC) when a
 *    date-only value (YYYY-MM-DD) is given. Internally we use a half-open interval [from, to).
 *  - Everything is UTC.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  /** inclusive lower bound */
  from?: Date;
  /** exclusive upper bound */
  to?: Date;
}

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

export function parseDateInput(value: string): Date | null {
  const d = new Date(isDateOnly(value) ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildDateRange(startDate?: string, endDate?: string): DateRange {
  const range: DateRange = {};
  if (startDate) {
    const d = parseDateInput(startDate);
    if (d) range.from = d;
  }
  if (endDate) {
    const d = parseDateInput(endDate);
    if (d) range.to = isDateOnly(endDate) ? new Date(d.getTime() + DAY_MS) : new Date(d.getTime() + 1);
  }
  return range;
}

export function createdAtFilter(range: DateRange): { createdAt?: { $gte?: Date; $lt?: Date } } {
  if (!range.from && !range.to) return {};
  const createdAt: { $gte?: Date; $lt?: Date } = {};
  if (range.from) createdAt.$gte = range.from;
  if (range.to) createdAt.$lt = range.to;
  return { createdAt };
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}
