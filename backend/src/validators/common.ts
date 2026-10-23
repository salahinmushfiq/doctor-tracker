import { z } from 'zod';
import mongoose from 'mongoose';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../utils/pagination';
import { isDateOnly, parseDateInput } from '../utils/dates';

/** 24-hex ObjectId, validated before it ever reaches Mongoose (no CastError surprises). */
export const objectIdSchema = z
  .string()
  .refine((v) => /^[a-f\d]{24}$/i.test(v) && mongoose.isValidObjectId(v), 'Invalid id');

export const idParams = z.object({ id: objectIdSchema });

const positiveInt = (name: string, max?: number) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be a positive integer`)
    .transform(Number)
    .pipe(max ? z.number().int().min(1).max(max) : z.number().int().min(1));

const dateParam = z
  .string()
  .trim()
  .refine((v) => parseDateInput(v) !== null && (isDateOnly(v) || v.includes('T')), 'Use an ISO date (YYYY-MM-DD) or ISO date-time');

/** Free-text search: plain string only (arrays / objects are rejected -> no operator injection). */
export const searchParam = z.string().trim().max(100, 'Search is too long');

export const paginationQuery = {
  page: positiveInt('page').default(1),
  limit: positiveInt('limit', MAX_LIMIT).default(DEFAULT_LIMIT),
};

export const dateRangeQuery = {
  startDate: dateParam.optional(),
  endDate: dateParam.optional(),
};

/** Cross-field rule shared by every list endpoint. */
export function refineDateRange<T extends z.ZodType<{ startDate?: string; endDate?: string }>>(schema: T) {
  return schema.refine(
    (q) => {
      if (!q.startDate || !q.endDate) return true;
      const s = parseDateInput(q.startDate);
      const e = parseDateInput(q.endDate);
      return !!s && !!e && s.getTime() <= e.getTime();
    },
    { message: 'startDate must be on or before endDate', path: ['startDate'] },
  );
}

export const sortOrderParam = z.enum(['asc', 'desc']).default('desc');

/** Trim; empty string -> undefined (so cleared form fields are treated as "not provided"). */
export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address'));

// Digits, spaces, +, -, (, ). 7-20 chars incl. separators; at least 7 digits overall.
export const phoneSchema = z
  .string()
  .trim()
  .max(25)
  .regex(/^[+()\d][\d\s().-]{5,23}$/, 'Enter a valid phone number')
  .refine((v) => v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15, 'Enter a valid phone number');
