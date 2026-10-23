import pino from 'pino';
import { env } from './env';

/**
 * Structured JSON logs. Nothing that could contain patient data is logged:
 *  - request bodies are never logged,
 *  - the query string is stripped from URLs (search terms can be patient names),
 *  - cookies / auth headers are redacted.
 */
export const logger = pino({
  level: env.isTest ? 'silent' : env.logLevel,
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]'],
    censor: '[redacted]',
  },
  ...(env.isProd || env.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }),
});

/** Path without query string or fragment. */
export function safePath(url: string | undefined): string {
  if (!url) return '';
  const idx = url.search(/[?#]/);
  return idx === -1 ? url : url.slice(0, idx);
}
