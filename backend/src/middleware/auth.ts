import type { RequestHandler } from 'express';
import { User } from '../models/User';
import type { Role } from '../models/constants';
import { AppError } from '../utils/AppError';
import { SESSION_COOKIE, verifySession } from '../utils/tokens';

/**
 * Authenticates the request from the HTTP-only session cookie.
 *  1. verify JWT signature / algorithm / expiry / issuer / audience,
 *  2. load the user and make sure the account is active and the token's `tv` matches
 *     `user.tokenVersion` (this is what makes logout a real server-side invalidation).
 * Costs one indexed _id read per request - an accepted trade-off, see docs/technical-decisions.md.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length === 0) return next(AppError.unauthenticated());

  const result = verifySession(token);
  if (!result.ok) return next(result.reason === 'expired' ? AppError.sessionExpired() : AppError.unauthenticated());

  const user = await User.findById(result.claims.sub).select('name email role isActive tokenVersion').lean();
  if (!user || !user.isActive || user.tokenVersion !== result.claims.tv) {
    return next(AppError.unauthenticated());
  }

  req.auth = { id: String(user._id), name: user.name, email: user.email, role: user.role, sid: result.claims.sid };
  next();
};

/** Authorization: the role comes from the database record, never from the (client-held) token. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthenticated());
    if (!roles.includes(req.auth.role)) return next(AppError.forbidden('Administrator access is required'));
    next();
  };
}
