// The app's SOFTURE configuration. `softure migrate` loads this file with Node's type stripping,
// so relative imports name their `.ts` files.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { defineSoftureConfig } from "@softure-ai/core";
import { registerSoftureConfig } from "@softure-ai/core/next";
import { featureSwitches } from "@softure-ai/feature-switches";
import { mailing, resend } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { ops } from "@softure-ai/ops";
import { cloudflareIp, security } from "@softure-ai/security";
import { sendPasswordResetLink } from "./lib/password-reset-sender.ts";
import { en } from "./messages/en.ts";
import { pl } from "./messages/pl.ts";
import { guestbook } from "./modules/guestbook/index.ts";

/** The example's switch: a welcome line on the home page (e2e/feature-switches.spec.ts flips it). */
export const WELCOME_BANNER_SWITCH = "example.welcome_banner";

/** The example's initial admin (auth's `adminEmails`); e2e/auth-roles.spec.ts registers it. */
export const EXAMPLE_ADMIN_EMAIL = "e2e-admin@example.com";

// The Postgres of compose.yaml; a local, throwaway database, so its password is not a secret.
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/softure_example";

const config = defineSoftureConfig({
  database: { url: process.env.DATABASE_URL ?? LOCAL_DATABASE_URL },
  locale: process.env.APP_LOCALE === "pl" ? "pl" : "en",
  timezone: "Europe/Warsaw",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  modules: [
    guestbook(),
    // The e2e sends CF-Connecting-IP itself, standing in for Cloudflare (e2e/security.spec.ts).
    security({
      clientIp: cloudflareIp(),
      buckets: { "example.ping": { limit: 3, windowMinutes: 15 }, ...AUTH_RATE_LIMIT_BUCKETS },
    }),
    auth({ routes: { afterLogin: "/account" }, adminEmails: [EXAMPLE_ADMIN_EMAIL], passwordReset: { send: sendPasswordResetLink } }),
    // `detail: "checks"` lists each check in the answer, so e2e/ops.spec.ts can see the guestbook's.
    ops({ detail: "checks" }),
    // The panel lives at /switches: /admin is the example's own admin page.
    featureSwitches({
      routes: { panel: "/switches" },
      switches: [
        {
          name: WELCOME_BANNER_SWITCH,
          label: { en: en.switches.welcomeBanner.label, pl: pl.switches.welcomeBanner.label },
          description: { en: en.switches.welcomeBanner.description, pl: pl.switches.welcomeBanner.description },
          default: false,
        },
      ],
    }),
    // Resend when a key is set; otherwise the fake provider, which the e2e reads through the outbox
    // file Playwright sets (MAIL_OUTBOX, e2e/mailing-transport.spec.ts). Without either, the fake
    // refuses to send under `next start`, so no mail silently disappears.
    mailing({
      from: "SOFTURE example <hello@mail.example.com>",
      replyTo: "support@example.com",
      provider: process.env.RESEND_API_KEY ? resend() : fakeMailProvider({ outboxFile: process.env.MAIL_OUTBOX || undefined }),
    }),
  ],
});

registerSoftureConfig(config);
export default config;
