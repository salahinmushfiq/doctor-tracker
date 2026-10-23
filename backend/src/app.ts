import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { isDatabaseConnected, pingDatabase } from './config/db';
import { logger, safePath } from './config/logger';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import { v1 } from './routes';

export function createApp(): Express {
  const app = express();

  // Behind Render/Vercel proxies the real client IP is in X-Forwarded-For; needed for rate limiting.
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Method + path only: no headers, no query string (search terms may be patient names), no bodies.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, path: safePath(req.url) }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      // Exact-match allow-list. Requests without an Origin header (curl, health checks) are not CORS requests.
      origin: (origin, cb) => cb(null, !origin || env.allowedOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );

  // Patient data must never be stored by browsers or shared caches.
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // Liveness: process is up. Readiness: database reachable. Neither reveals configuration or versions.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    const ready = isDatabaseConnected() && (await pingDatabase());
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  });

  app.use('/api', apiLimiter);
  if (!env.isProd) app.get('/api/v1/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
