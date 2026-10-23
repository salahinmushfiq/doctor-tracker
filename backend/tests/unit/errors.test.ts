import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { createTestLimiter } from '../../src/middleware/rateLimit';
import { validate } from '../../src/middleware/validate';
import { AppError } from '../../src/utils/AppError';
import { safePath } from '../../src/config/logger';
import { buildPagination, buildSort, MAX_OFFSET, skipFor } from '../../src/utils/pagination';

function appThrowing(err: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw err;
  });
  app.use(notFoundHandler, errorHandler);
  return app;
}

describe('central error handler', () => {
  const cases: Array<[string, unknown, number, string]> = [
    ['AppError', new AppError(409, 'CONFLICT', 'nope'), 409, 'CONFLICT'],
    ['ZodError', (() => { try { z.string().parse(1); } catch (e) { return e; } })(), 400, 'VALIDATION_ERROR'],
    ['CastError', new mongoose.Error.CastError('ObjectId', 'x', '_id'), 400, 'VALIDATION_ERROR'],
    ['duplicate key', new mongoose.mongo.MongoServerError({ message: 'E11000 duplicate key', code: 11000, keyPattern: { email: 1 } }), 409, 'CONFLICT'],
    ['server selection', Object.assign(new Error('no servers'), { name: 'MongoServerSelectionError' }), 503, 'DB_UNAVAILABLE'],
    ['buffering timeout', Object.assign(new Error('Operation buffering timed out'), { name: 'MongooseError' }), 503, 'DB_UNAVAILABLE'],
    ['unknown error', new Error('secret internal detail: mongodb://user:pass@host'), 500, 'INTERNAL_ERROR'],
  ];

  it.each(cases)('maps %s to %i %s', async (_name, err, status, code) => {
    const res = await request(appThrowing(err)).get('/boom');
    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ success: false, error: { code } });
  });

  it('never leaks internals or stack traces on unexpected errors', async () => {
    const res = await request(appThrowing(new Error('secret internal detail: mongodb://user:pass@host'))).get('/boom');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/secret internal detail|mongodb:\/\/|stack|at .*\.ts/);
  });

  it('does not reveal which field collided beyond the e-mail case', async () => {
    const res = await request(appThrowing(new mongoose.mongo.MongoServerError({ message: 'E11000', code: 11000, keyPattern: { email: 1 } }))).get('/boom');
    expect(res.body.error.message).toBe('A record with this email already exists');
  });
});

describe('validate middleware', () => {
  it('exposes parsed values on req.validated and never mutates req.query (read-only in Express 5)', async () => {
    const app = express();
    app.get('/x', validate({ query: z.object({ n: z.coerce.number().default(5) }) }), (req, res) => {
      res.json({ parsed: req.validated.query, raw: req.query });
    });
    app.use(errorHandler);
    const res = await request(app).get('/x?n=7');
    expect(res.body).toEqual({ parsed: { n: 7 }, raw: { n: '7' } });
  });

  it('aggregates issues from params, query and body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/x/:id', validate({ params: z.object({ id: z.string().length(3) }), query: z.object({ q: z.string() }), body: z.object({ b: z.string() }) }), (_req, res) => res.json({}));
    app.use(errorHandler);
    const res = await request(app).post('/x/12345').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['body.b', 'params.id', 'query.q']);
  });
});

describe('rate limiting', () => {
  it('returns 429 with the standard envelope once the budget is spent', async () => {
    const app = express();
    app.use(createTestLimiter(2));
    app.get('/x', (_req, res) => res.json({ ok: true }));
    expect((await request(app).get('/x')).status).toBe(200);
    expect((await request(app).get('/x')).status).toBe(200);
    const res = await request(app).get('/x');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
  });
});

describe('pagination helpers', () => {
  it('computes pages and handles empty result sets', () => {
    expect(buildPagination(1, 10, 0)).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(buildPagination(2, 10, 25)).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    expect(buildPagination(1, 10, 10).totalPages).toBe(1);
  });

  it('refuses absurdly deep offsets instead of scanning for them', () => {
    expect(skipFor(3, 10)).toBe(20);
    expect(() => skipFor(MAX_OFFSET / 10 + 2, 10)).toThrow(/too deep/i);
  });

  it('adds _id as a deterministic tie-breaker and rejects non-allow-listed fields', () => {
    expect(buildSort('fullName', 'asc', { fullName: 'nameSort' })).toEqual({ nameSort: 1, _id: 1 });
    expect(buildSort('createdAt', 'desc', { createdAt: 'createdAt' })).toEqual({ createdAt: -1, _id: -1 });
    expect(() => buildSort('hack', 'asc', { fullName: 'nameSort' })).toThrow();
  });
});

describe('log hygiene', () => {
  it('strips query strings (search terms can be patient names) from logged paths', () => {
    expect(safePath('/api/v1/patients?search=jane%20doe&condition=Oncology')).toBe('/api/v1/patients');
    expect(safePath('/api/v1/patients/abc#frag')).toBe('/api/v1/patients/abc');
    expect(safePath(undefined)).toBe('');
  });
});
