/**
 * Single entry point for talking to the Express API.
 *  - cookies are sent with `credentials: 'include'` (auth lives in an HTTP-only cookie; no tokens in JS storage)
 *  - the CSRF token is kept in module memory only and sent as X-CSRF-Token on mutations
 *  - every failure becomes an ApiError with a stable `code` the UI can switch on
 *  - a 401 on an authenticated call notifies the auth layer (session expired / revoked)
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

export type ApiErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'CSRF_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DOCTOR_HAS_PATIENTS'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'DB_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN';

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level problems from the server, with the `body.` prefix removed so they map onto form fields. */
  get fieldIssues(): FieldIssue[] {
    if (!Array.isArray(this.details)) return [];
    return this.details
      .filter((d): d is FieldIssue => typeof d?.path === 'string' && typeof d?.message === 'string')
      .map((d) => ({ path: d.path.replace(/^body\./, ''), message: d.message }));
  }

  get isNetwork() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(0, 'UNKNOWN', err instanceof Error ? err.message : 'Something went wrong');
}

/** Human-readable text for toasts / inline states. Never exposes raw server internals. */
export function describeError(err: unknown): string {
  const e = toApiError(err);
  switch (e.code) {
    case 'NETWORK':
      return 'Cannot reach the server. Check your connection and try again.';
    case 'TIMEOUT':
      return 'The server took too long to respond. It may be waking up - please try again.';
    case 'FORBIDDEN':
      return 'You do not have permission to do that.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'DB_UNAVAILABLE':
      return 'The service is temporarily unavailable. Please try again shortly.';
    case 'INTERNAL_ERROR':
      return 'Something went wrong on our side. Please try again.';
    case 'CSRF_FAILED':
      return 'Your session needs to be refreshed. Reload the page and try again.';
    default:
      return e.message || 'Something went wrong.';
  }
}

/* ── in-memory CSRF token & 401 hook ────────────────────────────────────── */
let csrfToken: string | null = null;
export const setCsrfToken = (t: string | null) => {
  csrfToken = t;
};
export const getCsrfToken = () => csrfToken;

type UnauthorizedHandler = (err: ApiError) => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export const setUnauthorizedHandler = (fn: UnauthorizedHandler | null) => {
  onUnauthorized = fn;
};

/* ── request ────────────────────────────────────────────────────────────── */
export type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  /** Do not treat 401 as "session lost" (login / initial /auth/me probe). */
  skipUnauthorizedHandler?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000; // generous: free-tier hosts can take a while to wake up

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  // Combine the caller's cancellation signal (TanStack Query) with our own timeout.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new DOMException('timeout', 'TimeoutError')), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout.signal]) : timeout.signal;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}${buildQuery(opts.query)}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err; // caller cancelled: let it propagate untouched
    if (timeout.signal.aborted) throw new ApiError(0, 'TIMEOUT', 'The request timed out');
    throw new ApiError(0, 'NETWORK', 'Network error');
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const e = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    const err = new ApiError(res.status, (e?.code as ApiErrorCode) ?? 'UNKNOWN', e?.message ?? `Request failed (${res.status})`, e?.details);
    if (res.status === 401 && !opts.skipUnauthorizedHandler) onUnauthorized?.(err);
    throw err;
  }
  return payload as T;
}

/** Unwraps `{ success, data }`. */
export async function apiData<T>(path: string, opts?: RequestOptions): Promise<T> {
  return (await api<{ data: T }>(path, opts)).data;
}
