import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Integration tests share one Postgres database and truncate it between tests.
    fileParallelism: false,
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
