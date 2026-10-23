import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** Dates are stored and displayed in UTC (same rule the API uses for ranges). */
export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '-');
export const formatDateTime = (iso: string | null | undefined) => (iso ? `${dateTimeFmt.format(new Date(iso))} UTC` : '-');

export function ageFrom(dobIso: string, now: Date = new Date()): number {
  const dob = new Date(dobIso);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(0, age);
}

export const toDateInput = (iso: string) => iso.slice(0, 10);

export const fmtNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);

export function plural(n: number, one: string, many = `${one}s`) {
  return `${fmtNumber(n)} ${n === 1 ? one : many}`;
}

/** YYYY-MM-DD for "today" in UTC, offset by `days`. */
export function utcDay(offsetDays = 0, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

/**
 * Validates a post-login redirect target. Only same-origin absolute paths are allowed
 * ("/doctors?page=2"); anything that could leave the site ("//evil.com", "https://...", "/\\evil") falls back.
 */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  if (next.startsWith('/login')) return fallback;
  return next;
}
