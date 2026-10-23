import { AppError } from './AppError';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}

/** Offset pagination gets slower linearly with depth; refuse absurd offsets instead of scanning for them. */
export const MAX_OFFSET = 50_000;

export function skipFor(page: number, limit: number): number {
  const skip = (page - 1) * limit;
  if (skip > MAX_OFFSET) {
    throw AppError.badRequest('Page is too deep. Narrow the results with search or filters instead.');
  }
  return skip;
}

/**
 * Build a Mongo sort spec from an allow-listed field.
 * `_id` is appended as a deterministic tie-breaker so offset pagination never repeats or skips
 * rows when many documents share the same sort value (e.g. identical createdAt).
 */
export function buildSort(
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  fieldMap: Record<string, string>,
): Record<string, 1 | -1> {
  const field = fieldMap[sortBy];
  if (!field) throw new Error(`sortBy "${sortBy}" is not allow-listed`);
  const dir = sortOrder === 'asc' ? 1 : -1;
  return field === '_id' ? { _id: dir } : { [field]: dir, _id: dir };
}
