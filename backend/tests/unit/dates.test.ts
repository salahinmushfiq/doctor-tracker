import { describe, expect, it } from 'vitest';
import { buildDateRange, createdAtFilter, isDateOnly, parseDateInput } from '../../src/utils/dates';

describe('date ranges (createdAt, UTC, half-open)', () => {
  it('treats a date-only endDate as inclusive of that whole day', () => {
    const r = buildDateRange('2026-03-01', '2026-03-31');
    expect(r.from?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(r.to?.toISOString()).toBe('2026-04-01T00:00:00.000Z'); // exclusive bound
  });

  it('honours an explicit time on endDate', () => {
    const r = buildDateRange(undefined, '2026-03-31T12:00:00.000Z');
    expect(r.to?.toISOString()).toBe('2026-03-31T12:00:00.001Z');
  });

  it('supports open-ended ranges', () => {
    expect(buildDateRange('2026-01-01')).toEqual({ from: new Date('2026-01-01T00:00:00.000Z') });
    expect(createdAtFilter({})).toEqual({});
  });

  it('createdAtFilter uses $gte / $lt', () => {
    expect(createdAtFilter(buildDateRange('2026-01-01', '2026-01-01'))).toEqual({
      createdAt: { $gte: new Date('2026-01-01T00:00:00.000Z'), $lt: new Date('2026-01-02T00:00:00.000Z') },
    });
  });

  it('parses and rejects inputs', () => {
    expect(isDateOnly('2026-01-01')).toBe(true);
    expect(isDateOnly('2026-01-01T00:00:00Z')).toBe(false);
    expect(parseDateInput('not-a-date')).toBeNull();
    expect(parseDateInput('2026-02-30')).not.toBeNull(); // JS rolls over; calendar validity is not our concern here
  });
});
