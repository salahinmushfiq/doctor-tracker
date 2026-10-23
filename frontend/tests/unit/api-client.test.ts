import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiData, buildQuery, describeError, setCsrfToken, setUnauthorizedHandler } from '@/lib/api-client';
import { API, apiError, server } from '../server';

describe('buildQuery', () => {
  it('drops empty values and encodes the rest', () => {
    expect(buildQuery({ a: 'x y', b: '', c: undefined, d: null, e: 0, f: false })).toBe('?a=x+y&e=0&f=false');
    expect(buildQuery({})).toBe('');
    expect(buildQuery()).toBe('');
  });
});

describe('api()', () => {
  it('sends the CSRF header on mutations only, with JSON body and no auth token in JS', async () => {
    const seen: Array<{ method: string; csrf: string | null; auth: string | null; ct: string | null }> = [];
    server.use(
      http.all(`${API}/probe`, ({ request }) => {
        seen.push({ method: request.method, csrf: request.headers.get('x-csrf-token'), auth: request.headers.get('authorization'), ct: request.headers.get('content-type') });
        return HttpResponse.json({ success: true, data: { ok: true } });
      }),
    );
    setCsrfToken('tok');
    await apiData('/probe');
    await apiData('/probe', { method: 'POST', body: { a: 1 } });
    await apiData('/probe', { method: 'DELETE' });
    expect(seen[0]).toMatchObject({ method: 'GET', csrf: null, auth: null });
    expect(seen[1]).toMatchObject({ method: 'POST', csrf: 'tok', auth: null, ct: 'application/json' });
    expect(seen[2]).toMatchObject({ method: 'DELETE', csrf: 'tok' });
  });

  it('normalises server errors into ApiError with code, status and field issues (body. prefix stripped)', async () => {
    server.use(http.post(`${API}/x`, () => apiError(400, 'VALIDATION_ERROR', 'Validation failed', [{ path: 'body.email', message: 'Enter a valid email address' }])));
    const err = await api<never>('/x', { method: 'POST', body: {} }).catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Validation failed' });
    expect(err.fieldIssues).toEqual([{ path: 'email', message: 'Enter a valid email address' }]);
  });

  it('maps unreachable servers to NETWORK errors with friendly text', async () => {
    server.use(http.get(`${API}/down`, () => HttpResponse.error()));
    const err = await api<never>('/down').catch((e: unknown) => e as ApiError);
    expect(err).toMatchObject({ code: 'NETWORK', status: 0 });
    expect(err.isNetwork).toBe(true);
    expect(describeError(err)).toMatch(/cannot reach the server/i);
  });

  it('handles non-JSON error bodies (e.g. a proxy HTML page) without throwing a parse error', async () => {
    server.use(http.get(`${API}/html`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })));
    const err = await api('/html').catch((e: unknown) => e as ApiError);
    expect(err).toMatchObject({ status: 502, code: 'UNKNOWN' });
  });

  it('notifies the auth layer on 401 - unless told to skip (login / initial /auth/me)', async () => {
    server.use(http.get(`${API}/private`, () => apiError(401, 'SESSION_EXPIRED', 'expired')));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await api('/private').catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    await api('/private', { skipUnauthorizedHandler: true }).catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('lets caller cancellation propagate as an abort, not as a network error', async () => {
    server.use(http.get(`${API}/slow`, async () => {
      await new Promise((r) => setTimeout(r, 200));
      return HttpResponse.json({});
    }));
    const ctrl = new AbortController();
    const p = api('/slow', { signal: ctrl.signal });
    ctrl.abort();
    const err = await p.catch((e: unknown) => e as ApiError);
    expect(err).not.toBeInstanceOf(ApiError);
  });

  it('describeError never leaks raw internals for 500s', () => {
    expect(describeError(new ApiError(500, 'INTERNAL_ERROR', 'stack: at /srv/app.js'))).not.toMatch(/stack|srv/);
    expect(describeError(new ApiError(403, 'FORBIDDEN', 'x'))).toMatch(/permission/i);
    expect(describeError(new ApiError(429, 'RATE_LIMITED', 'x'))).toMatch(/too many/i);
  });
});
