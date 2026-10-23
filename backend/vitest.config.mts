import { defineConfig } from 'vitest/config';

// Unit + HTTP-level tests: no database required.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: 30_000,
  },
});
