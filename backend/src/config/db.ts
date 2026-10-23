import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

// Fail fast instead of silently queueing queries while the database is unreachable.
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);
// NoSQL-injection defence lives in the validators (Zod rejects non-string / non-primitive input)
// and in the query builders, which only ever place user input in *value* positions.
// (mongoose's global `sanitizeFilter` is intentionally not used: it would also rewrap the
// trusted $regex / $gte operators our builders generate.)

export async function connectDatabase(uri: string = env.mongoUri): Promise<typeof mongoose> {
  mongoose.connection.on('error', (err) => logger.error({ err: err.message }, 'mongodb connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('mongodb disconnected'));
  await mongoose.connect(uri, {
    maxPoolSize: env.mongoMaxPoolSize,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 8_000,
    socketTimeoutMS: 30_000,
    // Fixes the pool for Atlas free tier (shared cluster, 500 connection cap).
    maxIdleTimeMS: 60_000,
  });
  // Make sure indexes declared on the schemas exist before serving traffic.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  logger.info('mongodb connected');
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/** 1 = connected. Used by the readiness probe. */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    if (!isDatabaseConnected() || !mongoose.connection.db) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
