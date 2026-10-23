/**
 * HTTP-level tests that need no database: the real Express app, real middleware, real JWTs.
 * Only the User lookup performed by requireAuth is mocked, so we can exercise the CSRF, role,
 * revocation and validation paths. DB-backed behaviour is covered in tests/integration.
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
vi.mock('../../src/models/User', () => ({
  User: { findById: () => ({ select: () => ({ lean: async () => state.user }) }) },
}));

import { createApp } from '../../src/app';
import { SESSION_COOKIE, csrfTokenFor, signSession } from '../../src/utils/tokens';

const app = createApp();
const ORIGIN = 'http://localhost:3000';
const ID = '65f1c0a1a1a1a1a1a1a1a1a1';

function sessionFor(role: 'admin' | 'viewer', tv = 0) {
  const { token, sid } = signSession({ sub: ID, role, tv });
  return { cookie: `${SESSION_COOKIE}=${token}`, csrf: csrfTokenFor(sid) };
}
const setUser = (role: 'admin' | 'viewer', extra: Record<string, unknown> = {}) => {
  state.user = { _id: ID, name: 'Test User', email: 't@example.com', role, isActive: true, tokenVersion: 0, ...extra };
};

beforeEach(() => {
  state.user = null;
});

describe('infrastructure endpoints', () => {
  it('liveness reveals nothing but status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('readiness is 503 when the database is not connected', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable' });
  });

  it('sets security headers, hides the framework and forbids caching', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('answers unknown routes with the JSON error envelope', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('serves the OpenAPI document outside production', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/doctors', '/patients', '/dashboard/overview', '/auth/login']));
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin with credentials', async () => {
    const res = await request(app).get('/health').set('Origin', ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not grant access to other origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight for the allowed origin and the CSRF header', async () => {
    const res = await request(app)
      .options('/api/v1/doctors')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-csrf-token');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('x-csrf-token');
  });
});

describe('authentication gate', () => {
  it.each(['/api/v1/auth/me', '/api/v1/doctors', '/api/v1/doctors/filters', `/api/v1/doctors/${ID}`, '/api/v1/patients', '/api/v1/dashboard/overview', '/api/v1/dashboard/trends'])(
    'GET %s without a session -> 401',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    },
  );

  it.each([['/api/v1/doctors'], ['/api/v1/patients']])('POST %s without a session -> 401', async (url) => {
    const res = await request(app).post(url).send({});
    expect(res.status).toBe(401);
  });

  it('rejects garbage and tampered cookies', async () => {
    const bad = await request(app).get('/api/v1/doctors').set('Cookie', `${SESSION_COOKIE}=garbage`);
    expect(bad.status).toBe(401);
    const { cookie } = sessionFor('admin');
    const tampered = await request(app).get('/api/v1/doctors').set('Cookie', cookie.slice(0, -3) + 'abc');
    expect(tampered.status).toBe(401);
  });

  it('distinguishes an expired session so the UI can say so', async () => {
    const expired = jwt.sign({ role: 'admin', sid: 's', tv: 0 }, process.env.JWT_SECRET!, { subject: ID, issuer: 'doctor-tracker-api', audience: 'doctor-tracker-web', expiresIn: -5 });
    const res = await request(app).get('/api/v1/doctors').set('Cookie', `${SESSION_COOKIE}=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('rejects a valid token whose user is gone, deactivated, or revoked (tokenVersion mismatch)', async () => {
    const { cookie } = sessionFor('admin', 0);
    state.user = null;
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    setUser('admin', { isActive: false });
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    setUser('admin', { tokenVersion: 1 }); // logout / password reset bumped the version
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('/auth/me returns the user plus a session-bound CSRF token', async () => {
    setUser('admin');
    const { cookie, csrf } = sessionFor('admin');
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: ID, name: 'Test User', email: 't@example.com', role: 'admin' });
    expect(res.body.data.csrfToken).toBe(csrf);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
  });

  it('takes the role from the database, not from the token', async () => {
    setUser('viewer'); // DB says viewer ...
    const { cookie, csrf } = sessionFor('admin'); // ... token claims admin
    const res = await request(app).post('/api/v1/doctors').set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('login endpoint (no database needed for these paths)', () => {
  const post = (body: unknown) => request(app).post('/api/v1/auth/login').set('Origin', ORIGIN).send(body as object);

  it('rejects a foreign Origin (login CSRF)', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('validates the body and returns field-level details', async () => {
    const res = await post({ email: 'nope', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['body.email', 'body.password']));
  });

  it('blocks NoSQL operator injection in the credentials', async () => {
    const res = await post({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (e.g. trying to smuggle a role)', async () => {
    expect((await post({ email: 'a@b.co', password: 'x', role: 'admin' })).status).toBe(400);
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    const bad = await request(app).post('/api/v1/auth/login').set('Origin', ORIGIN).set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    const big = await post({ email: 'a@b.co', password: 'x'.repeat(20_000) });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('exposes no registration or user-management endpoints', async () => {
    const urls = ['/api/v1/auth/register', '/api/v1/auth/signup', '/api/v1/auth/admin', '/api/v1/users'];
    const payload = { email: 'x@y.co', password: 'Passw0rd-xyz-123', role: 'admin' };

    // Anonymous callers can never create anything: they stop at the authentication gate.
    for (const url of urls) {
      const res = await request(app).post(url).set('Origin', ORIGIN).send(payload);
      expect(res.status, url).toBe(401);
    }

    // And even a fully authenticated admin finds no such route: accounts exist only via the seed CLI.
    setUser('admin');
    const { cookie, csrf } = sessionFor('admin');
    for (const url of urls) {
      const res = await request(app).post(url).set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send(payload);
      expect(res.status, url).toBe(404);
    }
  });

  it('logout without a session is a harmless success that clears the cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookies).toContain(`${SESSION_COOKIE}=;`);
  });
});

describe('CSRF protection on authenticated mutations', () => {
  const valid = { fullName: 'Dr. Amina Rahman', specialization: 'Cardiology', hospital: 'Northgate Clinic', phone: '+1-555-0101', email: 'amina@example.com' };

  it('requires the CSRF header', async () => {
    setUser('admin');
    const { cookie } = sessionFor('admin');
    const res = await request(app).post('/api/v1/doctors').set('Cookie', cookie).set('Origin', ORIGIN).send(valid);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('rejects a CSRF token from another session or a forged one', async () => {
    setUser('admin');
    const { cookie } = sessionFor('admin');
    const other = sessionFor('admin').csrf;
    for (const token of [other, 'forged', '']) {
      const res = await request(app).post('/api/v1/doctors').set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', token).send(valid);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_FAILED');
    }
  });

  it('rejects a foreign Origin even with a valid token', async () => {
    setUser('admin');
    const { cookie, csrf } = sessionFor('admin');
    const res = await request(app).post('/api/v1/doctors').set('Cookie', cookie).set('Origin', 'https://evil.example').set('X-CSRF-Token', csrf).send(valid);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('also guards PATCH and DELETE', async () => {
    setUser('admin');
    const { cookie } = sessionFor('admin');
    for (const [method, url] of [['patch', `/api/v1/doctors/${ID}`], ['delete', `/api/v1/doctors/${ID}`], ['delete', `/api/v1/patients/${ID}`], ['delete', `/api/v1/doctors/${ID}/patients/${ID}`]] as const) {
      const res = await request(app)[method](url).set('Cookie', cookie).set('Origin', ORIGIN).send({});
      expect(res.status, `${method} ${url}`).toBe(403);
      expect(res.body.error.code).toBe('CSRF_FAILED');
    }
  });

  it('does not require the token for reads', async () => {
    setUser('admin');
    const { cookie } = sessionFor('admin');
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});

describe('role-based authorization (viewer is read-only)', () => {
  it.each([
    ['post', '/api/v1/doctors'],
    ['patch', `/api/v1/doctors/${ID}`],
    ['delete', `/api/v1/doctors/${ID}`],
    ['post', '/api/v1/patients'],
    ['patch', `/api/v1/patients/${ID}`],
    ['delete', `/api/v1/patients/${ID}`],
    ['delete', `/api/v1/doctors/${ID}/patients/${ID}`],
  ] as const)('viewer %s %s -> 403 FORBIDDEN', async (method, url) => {
    setUser('viewer');
    const { cookie, csrf } = sessionFor('viewer');
    const res = await request(app)[method](url).set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('request validation behind authentication', () => {
  const auth = (role: 'admin' | 'viewer' = 'admin') => {
    setUser(role);
    return sessionFor(role);
  };

  it('rejects malformed ObjectIds before touching the database', async () => {
    const { cookie } = auth();
    for (const url of ['/api/v1/doctors/123', '/api/v1/patients/not-an-id', '/api/v1/doctors/zzzzzzzzzzzzzzzzzzzzzzzz/patients']) {
      const res = await request(app).get(url).set('Cookie', cookie);
      expect(res.status, url).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects invalid list parameters with field details', async () => {
    const { cookie } = auth();
    const res = await request(app).get('/api/v1/doctors?limit=1000&sortBy=passwordHash&page=0').set('Cookie', cookie);
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['query.limit', 'query.sortBy', 'query.page']));
  });

  it('rejects repeated query keys (array injection) and inverted date ranges', async () => {
    const { cookie } = auth();
    expect((await request(app).get('/api/v1/doctors?search=a&search=b').set('Cookie', cookie)).status).toBe(400);
    expect((await request(app).get('/api/v1/patients?startDate=2026-05-02&endDate=2026-05-01').set('Cookie', cookie)).status).toBe(400);
    expect((await request(app).get('/api/v1/dashboard/overview?startDate=2026-05-02&endDate=2026-05-01').set('Cookie', cookie)).status).toBe(400);
  });

  it('validates create-doctor payloads and reports every problem', async () => {
    const { cookie, csrf } = auth();
    const res = await request(app).post('/api/v1/doctors').set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({ fullName: 'A', email: 'bad', phone: 'x' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.fullName', 'body.email', 'body.phone', 'body.specialization', 'body.hospital']));
  });

  it('validates create-patient payloads (future DOB, unknown condition)', async () => {
    const { cookie, csrf } = auth();
    const res = await request(app).post('/api/v1/patients').set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({ fullName: 'Pat Ient', dateOfBirth: '2999-01-01', phone: '+1-555-0101', condition: 'Flu' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.dateOfBirth', 'body.condition']));
  });

  it('refuses mass-assignment of server-controlled fields', async () => {
    const { cookie, csrf } = auth();
    const res = await request(app).post('/api/v1/doctors').set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).send({ fullName: 'Dr. X Y', specialization: 'Cardiology', hospital: 'H H', phone: '+1-555-0101', email: 'x@y.co', _id: ID, createdAt: '2000-01-01' });
    expect(res.status).toBe(400);
  });
});
