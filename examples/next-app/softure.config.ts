// The app's SOFTURE configuration. `softure migrate` loads this file with Node's type stripping,
// so relative imports name their `.ts` files.
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { mailingResetSender } from "@softure-ai/auth/mailing";
import { defineSoftureConfig } from "@softure-ai/core";
import { registerSoftureConfig } from "@softure-ai/core/next";
import { featureSwitches } from "@softure-ai/feature-switches";
import { MCP_RATE_LIMIT_BUCKETS, mcpAccess } from "@softure-ai/mcp-access";
import { mailing, resend } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { ops } from "@softure-ai/ops";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { cloudflareIp, security } from "@softure-ai/security";
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
      buckets: { "example.ping": { limit: 3, windowMinutes: 15 }, ...AUTH_RATE_LIMIT_BUCKETS, ...MCP_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS },
    }),
    // Reset links go out as mail through the mailing module below (e2e/auth-reset-mail.spec.ts).
    auth({ routes: { afterLogin: "/account" }, adminEmails: [EXAMPLE_ADMIN_EMAIL], passwordReset: { send: mailingResetSender() } }),
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
    // The token page lives at /account/mcp and the endpoint at /api/mcp; the demo server is
    // lib/mcp-server.ts, whose tools e2e/mcp-access.spec.ts compares with this catalog.
    mcpAccess({
      serverName: "softure-example",
      allowWrites: true,
      tools: [
        { name: "whoami", access: "read", description: { en: en.mcp.whoami, pl: pl.mcp.whoami } },
        { name: "list_entries", access: "read", description: { en: en.mcp.listEntries, pl: pl.mcp.listEntries } },
        { name: "sign_guestbook", access: "write", description: { en: en.mcp.signGuestbook, pl: pl.mcp.signGuestbook } },
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
    // The export and account deletion at /account/privacy (e2e/privacy-export-delete.spec.ts). The
    // guestbook holds no user data, so the modules' own contributors are all there is to collect.
    privacy(),
  ],
});

registerSoftureConfig(config);
export default config;
