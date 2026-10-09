import { defineConfig, devices } from "@playwright/test";
import { softurePlaywrightUse } from "@softure-ai/testing/playwright";
import { MAIL_OUTBOX, MAILING_UNSUBSCRIBE_SECRET } from "./e2e/outbox.ts";

// A real payment in Stripe's sandbox (e2e/*.stripe-sandbox.spec.ts) against the built app on its own
// port, with billing on stripe(). It needs a test-mode STRIPE_SECRET_KEY and the signing secret of a
// running `stripe listen --forward-to localhost:<port>/api/billing/webhook` in STRIPE_WEBHOOK_SECRET
// (README "Stripe sandbox"; CI: the `stripe-sandbox` job of .github/workflows/e2e.yml). The main
// playwright.config.ts keeps playing Stripe with signed fixtures and ignores these specs.
const PORT = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /\.stripe-sandbox\.spec\.ts$/,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // One payment at a time: the listener forwards every event of the account to this one server.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    // Cloud sessions ship a Chromium of their own (PLAYWRIGHT_CHROMIUM_PATH); CI installs the one this Playwright expects.
    ...softurePlaywrightUse(),
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "stripe-sandbox", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --port ${String(PORT)}`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 60_000,
    env: {
      APP_ORIGIN: process.env.APP_ORIGIN ?? `http://localhost:${String(PORT)}`,
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
      MAIL_OUTBOX,
      MAILING_UNSUBSCRIBE_SECRET,
    },
  },
});
