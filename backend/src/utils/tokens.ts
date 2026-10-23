import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const SESSION_COOKIE = 'dt_session';

export interface SessionClaims {
  /** user id */
  sub: string;
  role: 'admin' | 'viewer';
  /** random per-login session id; the CSRF token is derived from it */
  sid: string;
  /** user.tokenVersion at issue time - bumping it server-side revokes every outstanding token */
  tv: number;
}

export function signSession(claims: Omit<SessionClaims, 'sid'> & { sid?: string }): { token: string; sid: string } {
  const sid = claims.sid ?? crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ role: claims.role, sid, tv: claims.tv }, env.jwt.secret, {
    algorithm: 'HS256',
    subject: claims.sub,
    expiresIn: env.jwt.expiresInSeconds,
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  });
  return { token, sid };
}

export type VerifyResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; reason: 'expired' | 'invalid' };

/** Verifies signature, algorithm, expiry, issuer and audience. */
export function verifySession(token: string): VerifyResult {
  try {
    const payload = jwt.verify(token, env.jwt.secret, {
      algorithms: ['HS256'],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    });
    if (typeof payload === 'string') return { ok: false, reason: 'invalid' };
    const { sub, role, sid, tv } = payload as Record<string, unknown>;
    if (
      typeof sub !== 'string' ||
      (role !== 'admin' && role !== 'viewer') ||
      typeof sid !== 'string' ||
      typeof tv !== 'number'
    ) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, claims: { sub, role, sid, tv } };
  } catch (err) {
    return { ok: false, reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }
}

/**
 * CSRF token bound to the session: HMAC(secret, "csrf:" + sid).
 * Stateless (nothing to store) yet unforgeable without the server secret, and it dies with the session.
 */
export function csrfTokenFor(sid: string): string {
  return crypto.createHmac('sha256', env.jwt.secret).update(`csrf:${sid}`).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
