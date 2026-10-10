import { defineConfig } from 'vitest/config';

// Date-key helpers use the runtime's local time zone; pin it so tests are deterministic.
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
});
