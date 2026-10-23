import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env';
import { authenticate, revokeSessions, toPublicUser } from '../services/auth.service';
import { AppError } from '../utils/AppError';
import { SESSION_COOKIE, csrfTokenFor, signSession, verifySession } from '../utils/tokens';
import type { LoginBody } from '../validators/auth';

const cookieBase: CookieOptions = {
  httpOnly: true, // not readable from JavaScript => XSS cannot steal the session
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  domain: env.cookie.domain,
  path: '/',
};

export const login: RequestHandler = async (req: Request, res: Response) => {
  const { email, password } = req.validated.body as LoginBody;
  const user = await authenticate(email, password);
  // One message for every failure mode: unknown e-mail, wrong password, deactivated account.
  if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const { token, sid } = signSession({ sub: String(user._id), role: user.role, tv: user.tokenVersion });
  res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: env.jwt.expiresInSeconds * 1000 });
  res.json({ success: true, data: { user: toPublicUser(user), csrfToken: csrfTokenFor(sid) } });
};

export const logout: RequestHandler = async (req: Request, res: Response) => {
  // Best effort: if a valid session cookie is present, revoke it server-side.
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string') {
    const result = verifySession(token);
    if (result.ok) await revokeSessions(result.claims.sub, result.claims.tv);
  }
  res.clearCookie(SESSION_COOKIE, cookieBase);
  res.json({ success: true, data: { loggedOut: true } });
};

export const me: RequestHandler = (req: Request, res: Response) => {
  const a = req.auth!;
  res.json({
    success: true,
    data: { user: { id: a.id, name: a.name, email: a.email, role: a.role }, csrfToken: csrfTokenFor(a.sid) },
  });
};
