// The same black-box suite against the same app built for Cloudflare Workers (docs/07-runtime-providers.md):
// `npm run build:cloudflare` first, then this config serves the OpenNext build in workerd through `wrangler dev`,
// with the Hyperdrive binding pointed at DATABASE_URL. Only the servers differ from playwright.config.ts: a Worker
// shares no disk with the test, so mail reaches the outbox file through a small sink (e2e/mail-outbox-sink.mjs).
import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";
import { FAKE_STRIPE_ORIGIN, FAKE_STRIPE_PORT, FAKE_STRIPE_SECRET_KEY, STRIPE_APP_PORT } from "./e2e/fake-stripe.ts";
import { BLOG_REFRESH_SECRET, MAIL_OUTBOX, MAILING_UNSUBSCRIBE_SECRET, STRIPE_WEBHOOK_SECRET } from "./e2e/outbox.ts";

// The specs that depend on the host read this (e2e/security.spec.ts).
process.env.E2E_HOST = "cloudflare";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const MAIL_OUTBOX_SINK_PORT = 3192;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/softure_example";

/** `wrangler dev` on one port, its own local state and inspector, with the given variables. */
function wranglerDev(port: number, inspectorPort: number, vars: Readonly<Record<string, string>>): string {
  const flags = Object.entries(vars).map(([name, value]) => `--var ${name}:${value}`);
  return [
    `npx wrangler dev --port ${String(port)} --ip 127.0.0.1 --inspector-port ${String(inspectorPort)}`,
    `--persist-to .wrangler/e2e-${String(port)}`,
    ...flags,
  ].join(" ");
}

const APP_VARS = {
  MAIL_OUTBOX_URL: `http://127.0.0.1:${String(MAIL_OUTBOX_SINK_PORT)}/outbox`,
  MAILING_UNSUBSCRIBE_SECRET,
  STRIPE_WEBHOOK_SECRET,
  BLOG_REFRESH_SECRET,
};
/** wrangler reads a local Hyperdrive's database from this variable, ahead of `localConnectionString`. */
const WRANGLER_ENV = { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: DATABASE_URL };

export default defineConfig({
  ...base,
  webServer: [
    {
      command: "node e2e/mail-outbox-sink.mjs",
      url: `http://127.0.0.1:${String(MAIL_OUTBOX_SINK_PORT)}/health`,
      reuseExistingServer: false,
      timeout: 15_000,
      env: { MAIL_OUTBOX_SINK_PORT: String(MAIL_OUTBOX_SINK_PORT), MAIL_OUTBOX },
    },
    {
      command: wranglerDev(PORT, 9230, { APP_ORIGIN: `http://localhost:${String(PORT)}`, ...APP_VARS }),
      url: `http://localhost:${String(PORT)}/robots.txt`,
      reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
      timeout: 120_000,
      env: WRANGLER_ENV,
    },
    {
      command: "node e2e/fake-stripe-server.mjs",
      url: `${FAKE_STRIPE_ORIGIN}/health`,
      reuseExistingServer: false,
      timeout: 15_000,
      env: {
        FAKE_STRIPE_PORT: String(FAKE_STRIPE_PORT),
        FAKE_STRIPE_WEBHOOK_URL: `http://localhost:${String(STRIPE_APP_PORT)}/api/billing/webhook`,
        STRIPE_WEBHOOK_SECRET,
      },
    },
    {
      command: wranglerDev(STRIPE_APP_PORT, 9231, {
        APP_ORIGIN: `http://localhost:${String(STRIPE_APP_PORT)}`,
        ...APP_VARS,
        BILLING_PROVIDER: "stripe",
        STRIPE_API_BASE: FAKE_STRIPE_ORIGIN,
        STRIPE_SECRET_KEY: FAKE_STRIPE_SECRET_KEY,
      }),
      url: `http://localhost:${String(STRIPE_APP_PORT)}/robots.txt`,
      reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
      timeout: 120_000,
      env: WRANGLER_ENV,
    },
  ],
});
