import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
  },
  webServer: [
    {
      command: 'npm run start --prefix server',
      url: 'http://localhost:3000/healthz',
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        FAST_TIMERS: 'true',
        PREVIEW_RATE_LIMIT_MAX: '1000',
      },
    },
    {
      command: 'npm run dev --prefix client -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
