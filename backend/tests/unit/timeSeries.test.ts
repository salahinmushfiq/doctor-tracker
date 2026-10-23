import { describe, expect, it } from 'vitest';
import { MAX_BUCKETS, buildSeries, chooseInterval, countBuckets, truncate } from '../../src/utils/timeSeries';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('truncate', () => {
  it('weeks start on Monday (UTC)', () => {
    expect(truncate(d('2026-10-23'), 'week').toISOString().slice(0, 10)).toBe('2026-10-19'); // Friday -> Monday
    expect(truncate(d('2026-10-25'), 'week').toISOString().slice(0, 10)).toBe('2026-10-19'); // Sunday -> Monday
    expect(truncate(d('2026-10-19'), 'week').toISOString().slice(0, 10)).toBe('2026-10-19');
  });
  it('months start on the 1st', () => {
    expect(truncate(new Date('2026-02-17T13:45:00Z'), 'month').toISOString().slice(0, 10)).toBe('2026-02-01');
  });
  it('days drop the time', () => {
    expect(truncate(new Date('2026-02-17T23:59:59Z'), 'day').toISOString()).toBe('2026-02-17T00:00:00.000Z');
  });
});

describe('chooseInterval', () => {
  it('derives granularity from the range length', () => {
    expect(chooseInterval(d('2026-10-01'), d('2026-10-20'))).toBe('day');
    expect(chooseInterval(d('2026-06-01'), d('2026-10-20'))).toBe('week');
    expect(chooseInterval(d('2025-01-01'), d('2026-10-20'))).toBe('month');
  });
  it('honours a requested interval only while the bucket count stays bounded', () => {
    expect(chooseInterval(d('2026-06-01'), d('2026-10-01'), 'day')).toBe('day');
    expect(countBuckets(d('2000-01-01'), d('2026-10-01'), 'day')).toBeGreaterThan(MAX_BUCKETS);
    expect(chooseInterval(d('2000-01-01'), d('2026-10-01'), 'day')).toBe('month');
  });
});

describe('buildSeries', () => {
  it('zero-fills gaps so the chart never interpolates across missing days', () => {
    const series = buildSeries(
      { from: d('2026-10-01'), to: d('2026-10-06') },
      'day',
      [{ _id: d('2026-10-02'), count: 2 }],
      [{ _id: d('2026-10-02'), count: 5 }, { _id: d('2026-10-05'), count: 1 }],
    );
    expect(series.map((p) => p.bucket)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(series.map((p) => p.doctors)).toEqual([0, 2, 0, 0, 0]);
    expect(series.map((p) => p.patients)).toEqual([0, 5, 0, 0, 1]);
  });

  it('buckets across a year boundary monthly', () => {
    const series = buildSeries(
      { from: d('2025-11-15'), to: d('2026-02-10') },
      'month',
      [],
      [{ _id: d('2026-01-01'), count: 3 }],
    );
    expect(series.map((p) => p.bucket)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
    expect(series.map((p) => p.patients)).toEqual([0, 0, 3, 0]);
  });

  it('weekly buckets align to Mondays', () => {
    const series = buildSeries({ from: d('2026-10-21'), to: d('2026-11-03') }, 'week', [], []);
    expect(series.map((p) => p.bucket)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
  });

  it('returns an empty series for an empty window', () => {
    expect(buildSeries({ from: d('2026-10-05'), to: d('2026-10-05') }, 'day', [], [])).toEqual([]);
  });
});
