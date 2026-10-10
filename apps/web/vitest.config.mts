import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Store, sync and health logic is plain TypeScript, so it is unit-tested in Node without a
// React Native runtime. The few Expo modules it touches are stubbed.
export default defineConfig({
  resolve: {
    alias: {
      '@/': fileURLToPath(new URL('./src/', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    env: { TZ: 'UTC', EXPO_PUBLIC_API_URL: 'http://api.test' },
  },
});
