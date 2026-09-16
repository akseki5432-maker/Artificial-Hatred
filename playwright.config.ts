import { defineConfig } from '@playwright/test';

/**
 * End-to-end smoke test. Builds nothing itself: run `npm run build` first so
 * web/dist exists, then the API serves the built app on a scratch database.
 * Set PW_CHROMIUM_PATH to use a preinstalled Chromium instead of the bundled one.
 */
const PORT = Number(process.env.E2E_PORT ?? 3977);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  // One worker: every spec talks to the same server and database.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm start -w server`,
    port: PORT,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      POCKETPILOT_DB: ':memory:',
      ENABLE_DDG_SEARCH: '0',
      ENABLE_LIVE_FX: '0',
      PRICE_REFRESH_DELAY_MS: '0',
    },
    timeout: 60_000,
  },
});
