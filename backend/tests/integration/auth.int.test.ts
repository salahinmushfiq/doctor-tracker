import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { User } from '../../src/models/User';
import { ORIGIN, PASSWORD, connect, createUser, login, resetData, teardown, mongoUri } from './helpers';

const app = createApp();

describe.skipIf(!mongoUri)('auth (integration)', () => {
  beforeAll(() => connect());
  afterAll(() => teardown());
  beforeEach(resetData);

  const post = (body: object) => request(app).post('/api/v1/auth/login').set('Origin', ORIGIN).send(body);

  it('logs in, sets an HTTP-only SameSite cookie and returns the user + CSRF token', async () => {
    await createUser('admin');
    const res = await post({ email: 'admin@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('dt_session='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(res.body.data.user).toMatchObject({ email: 'admin@example.com', role: 'admin' });
    expect(res.body.data.csrfToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('stores only a bcrypt hash and records lastLoginAt', async () => {
    await createUser('admin');
    await post({ email: 'admin@example.com', password: PASSWORD });
    const u = await User.findOne({ email: 'admin@example.com' }).select('+passwordHash');
    expect(u!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(u!.passwordHash).not.toContain(PASSWORD);
    expect(u!.lastLoginAt).toBeInstanceOf(Date);
  });

  it('treats e-mail case-insensitively', async () => {
    await createUser('admin');
    expect((await post({ email: 'ADMIN@Example.COM', password: PASSWORD })).status).toBe(200);
  });

  it('gives an identical response for unknown e-mail and wrong password (no user enumeration)', async () => {
    await createUser('admin');
    const wrongPw = await post({ email: 'admin@example.com', password: 'wrong-password-123' });
    const noUser = await post({ email: 'ghost@example.com', password: 'wrong-password-123' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body).toEqual(noUser.body);
    expect(wrongPw.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(noUser.headers['set-cookie']).toBeUndefined();
  });

  it('refuses deactivated accounts with the same generic error', async () => {
    await createUser('admin', { isActive: false });
    const res = await post({ email: 'admin@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logout revokes the session server-side: the old cookie stops working', async () => {
    await createUser('admin');
    const loginRes = await post({ email: 'admin@example.com', password: PASSWORD });
    const cookie = ([] as string[]).concat(loginRes.headers['set-cookie'] ?? []).find((c) => c.startsWith('dt_session='))!.split(';')[0]!;

    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);

    const out = await request(app).post('/api/v1/auth/logout').set('Origin', ORIGIN).set('Cookie', cookie);
    expect(out.status).toBe(200);

    // A stolen / replayed copy of the cookie is useless after logout.
    const replay = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(replay.status).toBe(401);
  });

  it('a password reset (tokenVersion bump) invalidates existing sessions', async () => {
    await createUser('admin');
    const s = await login(app, 'admin');
    expect((await s.get('/api/v1/auth/me')).status).toBe(200);
    await User.updateOne({ email: 'admin@example.com' }, { $inc: { tokenVersion: 1 } });
    expect((await s.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('a user deleted after login loses access immediately', async () => {
    const s = await login(app, 'admin');
    await User.deleteMany({});
    expect((await s.get('/api/v1/doctors')).status).toBe(401);
  });

  it('end-to-end CSRF: mutation succeeds with token+origin, fails without', async () => {
    const s = await login(app, 'admin');
    const body = { fullName: 'Dr. Csrf Test', specialization: 'Cardiology', hospital: 'Northgate Clinic', phone: '+1-555-0101', email: 'csrf@example.com' };
    expect((await s.agent.post('/api/v1/doctors').set('Origin', ORIGIN).send(body)).status).toBe(403);
    expect((await s.post('/api/v1/doctors', body)).status).toBe(201);
  });

  it('viewer can read but not write', async () => {
    const s = await login(app, 'viewer');
    expect((await s.get('/api/v1/doctors')).status).toBe(200);
    const res = await s.post('/api/v1/doctors', { fullName: 'Dr. No Access', specialization: 'Cardiology', hospital: 'Northgate Clinic', phone: '+1-555-0101', email: 'no@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
