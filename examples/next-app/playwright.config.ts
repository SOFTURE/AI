import { defineConfig, devices } from "@playwright/test";

// Black-box tests of the built app (`next build` first). Playwright starts `next start` itself; with
// E2E_REUSE_SERVER=1 it uses a server already on the port instead (for example `next dev` while
// writing a test). The database must be migrated: `npm run migrate`.
const PORT = Number(process.env.E2E_PORT ?? 3100);
// Cloud sessions ship a Chromium of their own; CI installs the one this Playwright expects.
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // No retries: a test that passes on the second try is a flaky test, not a green one.
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never by default: a stale server left on the port would be tested instead of the fresh build.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 60_000,
    // The app builds absolute URLs (the auth guard's redirect) on APP_ORIGIN: the port under test.
    env: { APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${String(PORT)}` },
  },
});
