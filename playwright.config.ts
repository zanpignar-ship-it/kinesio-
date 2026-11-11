import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Local runs: Supabase settings for test helpers come from .env.local (next start reads it on its own).
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
// Sandboxes that only reach the internet through an HTTPS proxy: let Node's fetch use it.
if (process.env.HTTPS_PROXY) process.env.NODE_USE_ENV_PROXY = '1';
process.env.NEXT_TELEMETRY_DISABLED = '1';

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
