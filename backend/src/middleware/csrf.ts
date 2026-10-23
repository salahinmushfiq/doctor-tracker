import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { csrfTokenFor, safeEqual } from '../utils/tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Layer 1 - Origin verification for every state-changing request (including login).
 * Browsers always attach Origin to cross-origin POST/PATCH/DELETE; if it is present it must be
 * one of our configured frontend origins. Falls back to Referer when Origin is absent.
 * Requests with neither header (curl, server-to-server) are not browser-driven CSRF vectors and
 * still have to pass layer 2 where a session exists.
 */
export const verifyOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin ?? undefined;
  const source = originOf(origin) ?? (origin ? 'invalid' : originOf(req.headers.referer));
  if (source === 'invalid') return next(new AppError(403, 'CSRF_FAILED', 'Request origin is not allowed'));
  if (source && !env.allowedOrigins.includes(source)) {
    return next(new AppError(403, 'CSRF_FAILED', 'Request origin is not allowed'));
  }
  next();
};

/**
 * Layer 2 - synchronizer-style token for authenticated mutations. The token is
 * HMAC(secret, session id): handed to the SPA in the login / me response body, kept in memory,
 * and echoed in the X-CSRF-Token header. A cross-site attacker can neither read the response
 * (CORS) nor forge the HMAC, and SameSite cookies are only an additional layer.
 * Must run after requireAuth.
 */
export const verifyCsrfToken: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.auth) return next(AppError.unauthenticated());
  const supplied = req.headers[CSRF_HEADER];
  if (typeof supplied !== 'string' || !safeEqual(supplied, csrfTokenFor(req.auth.sid))) {
    return next(new AppError(403, 'CSRF_FAILED', 'Missing or invalid CSRF token'));
  }
  next();
};
