import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { csrfTokenFor, safeEqual, signSession, verifySession } from '../../src/utils/tokens';

const SECRET = process.env.JWT_SECRET!;

describe('session tokens', () => {
  it('round-trips claims', () => {
    const { token, sid } = signSession({ sub: 'u1', role: 'admin', tv: 3 });
    const r = verifySession(token);
    expect(r).toEqual({ ok: true, claims: { sub: 'u1', role: 'admin', sid, tv: 3 } });
  });

  it('reports expiry distinctly from invalidity', () => {
    const expired = jwt.sign({ role: 'admin', sid: 's', tv: 0 }, SECRET, { subject: 'u', issuer: 'doctor-tracker-api', audience: 'doctor-tracker-web', expiresIn: -10 });
    expect(verifySession(expired)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects tampered signatures, wrong secret, wrong issuer and wrong audience', () => {
    const { token } = signSession({ sub: 'u1', role: 'viewer', tv: 0 });
    expect(verifySession(token.slice(0, -2) + 'xx')).toEqual({ ok: false, reason: 'invalid' });
    const wrongSecret = jwt.sign({ role: 'admin', sid: 's', tv: 0 }, 'another-secret-another-secret-123456', { subject: 'u', issuer: 'doctor-tracker-api', audience: 'doctor-tracker-web' });
    expect(verifySession(wrongSecret).ok).toBe(false);
    const wrongIss = jwt.sign({ role: 'admin', sid: 's', tv: 0 }, SECRET, { subject: 'u', issuer: 'evil', audience: 'doctor-tracker-web' });
    expect(verifySession(wrongIss).ok).toBe(false);
    const wrongAud = jwt.sign({ role: 'admin', sid: 's', tv: 0 }, SECRET, { subject: 'u', issuer: 'doctor-tracker-api', audience: 'evil' });
    expect(verifySession(wrongAud).ok).toBe(false);
  });

  it('rejects the "none" algorithm and algorithm-confusion attempts', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u', role: 'admin', sid: 's', tv: 0, iss: 'doctor-tracker-api', aud: 'doctor-tracker-web', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
    expect(verifySession(`${header}.${payload}.`).ok).toBe(false);
    const hs512 = jwt.sign({ role: 'admin', sid: 's', tv: 0 }, SECRET, { algorithm: 'HS512', subject: 'u', issuer: 'doctor-tracker-api', audience: 'doctor-tracker-web' });
    expect(verifySession(hs512).ok).toBe(false);
  });

  it('rejects well-signed tokens with malformed claims (e.g. an unknown role)', () => {
    const t = jwt.sign({ role: 'superuser', sid: 's', tv: 0 }, SECRET, { subject: 'u', issuer: 'doctor-tracker-api', audience: 'doctor-tracker-web' });
    expect(verifySession(t)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects garbage', () => {
    expect(verifySession('not.a.jwt').ok).toBe(false);
    expect(verifySession('').ok).toBe(false);
  });
});

describe('csrf token', () => {
  it('is deterministic per session and different across sessions', () => {
    expect(csrfTokenFor('a')).toBe(csrfTokenFor('a'));
    expect(csrfTokenFor('a')).not.toBe(csrfTokenFor('b'));
  });
  it('is keyed by the server secret, so it is not derivable from the session id alone', () => {
    const unkeyed = crypto.createHash('sha256').update('csrf:a').digest('base64url');
    expect(csrfTokenFor('a')).not.toBe(unkeyed);
    expect(csrfTokenFor('a').length).toBeGreaterThan(30);
  });
  it('safeEqual compares in constant-time-safe fashion and handles length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
