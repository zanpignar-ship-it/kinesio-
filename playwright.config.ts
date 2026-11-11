import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  // Browsers in Slovenia send sl-SI; next-intl picks the locale from Accept-Language.
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, locale: 'sl-SI' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run build && npx next start -p ${PORT}`, port: PORT, reuseExistingServer: true, timeout: 180_000 },
});
