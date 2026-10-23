import { defineConfig } from 'vitest/config';

// Integration tests against an isolated in-memory MongoDB (see tests/global-setup.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false, // suites share one mongod and reset data between tests
    testTimeout: 30_000,
    hookTimeout: 180_000, // first run may need to download a mongod binary
  },
});
