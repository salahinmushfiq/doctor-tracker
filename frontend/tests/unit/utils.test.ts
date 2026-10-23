import { describe, expect, it } from 'vitest';
import { ageFrom, formatDate, plural, safeNext, utcDay } from '@/lib/utils';
import { PRESETS, rangeFor } from '@/features/dashboard/date-range';
import { buildChips } from '@/features/common/list-controls';

describe('safeNext (open-redirect guard)', () => {
  it.each([
    ['/doctors?page=2', '/doctors?page=2'],
    ['/patients/abc/edit', '/patients/abc/edit'],
  ])('keeps same-site path %s', (input, out) => expect(safeNext(input)).toBe(out));

  it.each([['//evil.com'], ['https://evil.com'], ['/\\evil.com'], ['javascript:alert(1)'], ['evil'], [''], [null], [undefined], ['/login'], ['/login?next=/x'], ['/ok\r\nSet-Cookie: x=1']])('rejects %s', (input) => {
    expect(safeNext(input as string | null)).toBe('/dashboard');
  });
});

describe('formatting helpers', () => {
  it('formats dates in UTC so the day never shifts with the viewer timezone', () => {
    expect(formatDate('2026-03-01T23:30:00.000Z')).toBe('01 Mar 2026');
    expect(formatDate(null)).toBe('-');
  });
  it('computes age around the birthday', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(ageFrom('1990-10-23T00:00:00.000Z', now)).toBe(36);
    expect(ageFrom('1990-10-24T00:00:00.000Z', now)).toBe(35);
    expect(ageFrom('2030-01-01T00:00:00.000Z', now)).toBe(0);
  });
  it('pluralises', () => {
    expect(plural(1, 'patient')).toBe('1 patient');
    expect(plural(2, 'patient')).toBe('2 patients');
    expect(plural(1200, 'patient')).toBe('1,200 patients');
  });
  it('utcDay offsets', () => expect(utcDay(-6, new Date('2026-10-23T23:59:59Z'))).toBe('2026-10-17'));
});

describe('dashboard date presets', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  it('7d is inclusive of today (7 calendar days)', () => expect(rangeFor('7d', {}, now)).toEqual({ startDate: '2026-10-17', endDate: '2026-10-23' }));
  it('30d / 90d / 12m', () => {
    expect(rangeFor('30d', {}, now).startDate).toBe('2026-09-24');
    expect(rangeFor('90d', {}, now).startDate).toBe('2026-07-26');
    expect(rangeFor('12m', {}, now).startDate).toBe('2025-10-24');
  });
  it('all time sends no dates; custom passes them through', () => {
    expect(rangeFor('all', {}, now)).toEqual({});
    expect(rangeFor('custom', { startDate: '2026-01-01', endDate: '' }, now)).toEqual({ startDate: '2026-01-01', endDate: undefined });
  });
  it('offers the documented presets', () => expect(PRESETS.map((p) => p.id)).toEqual(['7d', '30d', '90d', '12m', 'all', 'custom']));
});

describe('filter chips', () => {
  it('shows only set filters, formats dates', () => {
    const chips = buildChips({ search: 'amin', startDate: '2026-03-01' }, { search: 'Search', specialization: 'Specialization', startDate: 'From' });
    expect(chips).toEqual([
      { key: 'search', label: 'Search', value: 'amin' },
      { key: 'startDate', label: 'From', value: '01 Mar 2026' },
    ]);
  });
});
