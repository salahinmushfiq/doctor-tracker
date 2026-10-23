import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URI of the isolated in-memory MongoDB, or '' when none could be started. */
    mongoUri: string;
  }
}

/**
 * Starts ONE isolated in-memory MongoDB for the integration run (never touches a real database).
 * If the mongod binary cannot be obtained (e.g. offline sandbox) the suites are SKIPPED with a visible
 * warning; set REQUIRE_DB_TESTS=1 (as CI does) to turn that into a hard failure instead.
 */
export default async function setup(project: TestProject) {
  let mongo: MongoMemoryServer | null = null;
  try {
    mongo = await MongoMemoryServer.create();
  } catch (err) {
    if (process.env.REQUIRE_DB_TESTS === '1') throw err;
    console.warn(`\n[integration] SKIPPED - could not start MongoDB: ${err instanceof Error ? err.message.split('\n')[0] : err}\n`);
  }
  project.provide('mongoUri', mongo ? mongo.getUri('doctor_tracker_test') : '');
  return async () => {
    await mongo?.stop();
  };
}
