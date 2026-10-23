import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/AppError';

type Parts = { query?: z.ZodType; body?: z.ZodType; params?: z.ZodType };

export function formatZodError(err: z.ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Validates query/body/params with Zod and exposes the parsed (coerced, defaulted) result on
 * `req.validated`. Unknown keys in strict schemas are rejected, and non-primitive values where a
 * string is expected (e.g. `?search[$ne]=x` or `{"email":{"$ne":null}}`) fail validation.
 */
export function validate(parts: Parts): RequestHandler {
  return (req, _res, next) => {
    req.validated = {};
    const issues: Array<{ path: string; message: string }> = [];
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = parts[key];
      if (!schema) continue;
      const result = schema.safeParse(key === 'body' ? (req.body ?? {}) : req[key]);
      if (result.success) req.validated[key] = result.data;
      else issues.push(...formatZodError(result.error).map((i) => ({ ...i, path: `${key}.${i.path}`.replace(/\.$/, '') })));
    }
    if (issues.length > 0) return next(AppError.badRequest('Validation failed', issues));
    next();
  };
}
