import 'dotenv/config';
import { z } from 'zod';

const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN_MINUTES: z.coerce.number().int().min(1).max(24 * 60).default(60),
    JWT_ISSUER: z.string().min(1).default('doctor-tracker-api'),
    JWT_AUDIENCE: z.string().min(1).default('doctor-tracker-web'),

    FRONTEND_URL: z.string().min(1, 'FRONTEND_URL is required'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_SECURE: boolish.optional(),
    COOKIE_DOMAIN: z.string().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  })
  .transform((raw) => {
    const isProd = raw.NODE_ENV === 'production';
    return {
      nodeEnv: raw.NODE_ENV,
      isProd,
      isTest: raw.NODE_ENV === 'test',
      port: raw.PORT,
      logLevel: raw.LOG_LEVEL,
      mongoUri: raw.MONGODB_URI,
      mongoMaxPoolSize: raw.MONGO_MAX_POOL_SIZE,
      jwt: {
        secret: raw.JWT_SECRET,
        expiresInSeconds: raw.JWT_EXPIRES_IN_MINUTES * 60,
        issuer: raw.JWT_ISSUER,
        audience: raw.JWT_AUDIENCE,
      },
      allowedOrigins: raw.FRONTEND_URL.split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean),
      cookie: {
        sameSite: raw.COOKIE_SAMESITE,
        secure: raw.COOKIE_SECURE ?? isProd,
        domain: raw.COOKIE_DOMAIN || undefined,
      },
      trustProxy: raw.TRUST_PROXY,
    };
  })
  .superRefine((cfg, ctx) => {
    // Browsers reject SameSite=None cookies that are not Secure.
    if (cfg.cookie.sameSite === 'none' && !cfg.cookie.secure) {
      ctx.addIssue({ code: 'custom', message: 'COOKIE_SAMESITE=none requires COOKIE_SECURE=true' });
    }
    if (cfg.isProd && !cfg.cookie.secure) {
      ctx.addIssue({ code: 'custom', message: 'COOKIE_SECURE must be true in production' });
    }
    if (cfg.isProd && cfg.allowedOrigins.some((o) => !o.startsWith('https://'))) {
      ctx.addIssue({ code: 'custom', message: 'FRONTEND_URL must use https in production' });
    }
  });

export type Env = z.output<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Print variable names / problems only, never values (they may be secrets).
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'config'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

function loadOrExit(): Env {
  try {
    return loadEnv();
  } catch (err) {
    // Tests want the exception; a real process should print the problem list (names only) and stop.
    if (process.env.NODE_ENV === 'test') throw err;
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export const env: Env = loadOrExit();
