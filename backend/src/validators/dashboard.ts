import { z } from 'zod';
import { dateRangeQuery, refineDateRange } from './common';

export const TREND_INTERVALS = ['day', 'week', 'month'] as const;
export type TrendInterval = (typeof TREND_INTERVALS)[number];

/** Shared by every dashboard endpoint so all widgets always describe the same window. */
export const dashboardQuery = refineDateRange(
  z.object({
    ...dateRangeQuery,
    /** Optional override; by default it is derived from the length of the range. */
    interval: z.enum(TREND_INTERVALS).optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(25))
      .default(10),
  }).strict(),
);
export type DashboardQuery = z.infer<typeof dashboardQuery>;
