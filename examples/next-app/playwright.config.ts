import { defineConfig, devices } from "@playwright/test";
import { MAIL_OUTBOX, MAILING_UNSUBSCRIBE_SECRET, STRIPE_WEBHOOK_SECRET } from "./e2e/outbox.ts";

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
  // `*.serial.spec.ts` files change state every other spec relies on (closing registration), so they
  // run alone, after the parallel project has finished.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.serial\.spec\.ts$/ },
    { name: "serial", use: { ...devices["Desktop Chrome"] }, testMatch: /\.serial\.spec\.ts$/, dependencies: ["chromium"] },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never by default: a stale server left on the port would be tested instead of the fresh build.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 60_000,
    // The app builds absolute URLs (the auth guard's redirect, reset links) on APP_ORIGIN: the port
    // under test. Mail from the fake mail provider, reset links included, goes to the outbox file
    // the e2e reads (softure.config.ts). List mail is signed with a fixed test secret, and so are
    // the Stripe webhook deliveries the e2e plays.
    env: { APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${String(PORT)}`, MAIL_OUTBOX, MAILING_UNSUBSCRIBE_SECRET, STRIPE_WEBHOOK_SECRET },
  },
});
