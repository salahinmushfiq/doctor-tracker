import type { Server } from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';

async function main() {
  await connectDatabase();
  const app = createApp();
  // Render (and most PaaS) inject PORT; bind to all interfaces.
  const server: Server = app.listen(env.port, '0.0.0.0', () => logger.info({ port: env.port, env: env.nodeEnv }, 'api listening'));

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    // Stop accepting connections, let in-flight requests finish, then close the DB pool.
    const force = setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
    force.unref();
    server.close(async () => {
      await disconnectDatabase().catch(() => undefined);
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason: String(reason) }, 'unhandled rejection'));
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, 'failed to start');
  process.exit(1);
});
