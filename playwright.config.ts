import { defineConfig } from '@playwright/test';

/**
 * E2E smoke tests run the real stack: the bundled API against Postgres and the exported web
 * build. `npm run test:e2e` builds both first (the web build bakes in EXPO_PUBLIC_API_URL).
 */
const API_PORT = 4310;
const WEB_PORT = 8090;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 375, height: 812 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Lets sandboxes with a pre-installed Chromium skip `playwright install`.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node apps/api/dist/server.js',
      url: `http://localhost:${API_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          'postgres://postgres:postgres@localhost:5432/fittrack_e2e',
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        LOG_LEVEL: 'warn',
        AUTH_RATE_LIMIT_PER_MINUTE: '1000',
        DEMO_RATE_LIMIT_PER_HOUR: '1000',
      },
    },
    {
      command: `node e2e/serve-web.mjs apps/web/dist ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
});

export const E2E_API_URL = `http://localhost:${API_PORT}`;
