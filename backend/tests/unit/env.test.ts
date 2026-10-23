import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';

const base = {
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
  JWT_SECRET: 'x'.repeat(40),
  FRONTEND_URL: 'http://localhost:3000',
};
const prod = { ...base, NODE_ENV: 'production', FRONTEND_URL: 'https://app.example.com', COOKIE_SECURE: 'true' };

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const e = loadEnv(base);
    expect(e).toMatchObject({ port: 4000, isProd: false, cookie: { sameSite: 'lax', secure: false }, jwt: { expiresInSeconds: 3600 } });
  });

  it('requires a strong JWT secret and a database URI, and never echoes values in errors', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...base, MONGODB_URI: '' })).toThrow(/MONGODB_URI/);
    try {
      loadEnv({ ...base, MONGODB_URI: 'mongodb://user:hunter2@host/db', JWT_SECRET: 'tiny' });
    } catch (e) {
      expect(String(e)).not.toContain('hunter2');
      expect(String(e)).not.toContain('tiny');
    }
  });

  it('parses a comma-separated, trailing-slash-insensitive origin allow-list', () => {
    expect(loadEnv({ ...base, FRONTEND_URL: 'http://localhost:3000/, https://a.example.com ' }).allowedOrigins).toEqual(['http://localhost:3000', 'https://a.example.com']);
  });

  it('defaults cookies to Secure in production', () => {
    expect(loadEnv({ ...prod, COOKIE_SECURE: undefined }).cookie.secure).toBe(true);
  });

  it('refuses insecure production configurations', () => {
    expect(() => loadEnv({ ...prod, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadEnv({ ...prod, FRONTEND_URL: 'http://app.example.com' })).toThrow(/https/);
  });

  it('SameSite=None (cross-site deployment) requires Secure cookies', () => {
    expect(() => loadEnv({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' })).toThrow(/SECURE/i);
    expect(loadEnv({ ...prod, COOKIE_SAMESITE: 'none' }).cookie).toMatchObject({ sameSite: 'none', secure: true });
  });

  it('rejects out-of-range numbers and unknown enum values', () => {
    expect(() => loadEnv({ ...base, PORT: '70000' })).toThrow();
    expect(() => loadEnv({ ...base, COOKIE_SAMESITE: 'whatever' })).toThrow();
    expect(() => loadEnv({ ...base, NODE_ENV: 'staging' })).toThrow();
  });
});
