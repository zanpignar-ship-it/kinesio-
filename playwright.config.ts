import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", locale: "sl-SI", timezoneId: "Europe/Ljubljana" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 960 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: { command: `pnpm dev --port ${PORT}`, port: PORT, reuseExistingServer: true, timeout: 120_000 },
});
