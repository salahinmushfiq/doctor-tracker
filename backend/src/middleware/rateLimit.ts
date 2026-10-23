import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env';

function handler(_req: Request, res: Response) {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
  });
}

const base: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
  // Tests exercise the limiter explicitly with their own instance.
  skip: () => env.isTest,
};

/** Broad protection for the whole API. */
export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 600 });

/**
 * Brute-force protection for login: keyed by client IP *and* the submitted e-mail so one attacker
 * cannot lock a victim out from everywhere, and one IP cannot spray many accounts cheaply.
 * Successful logins do not count against the budget.
 */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
  },
});

/** Coarser per-IP cap on login attempts regardless of e-mail (password spraying). */
export const loginIpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 40,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

export function createTestLimiter(limit: number) {
  return rateLimit({ ...base, skip: () => false, windowMs: 60_000, limit, keyGenerator: (req) => ipKeyGenerator(req.ip ?? '') });
}
