// The app's SOFTURE configuration. `softure migrate` loads this file with Node's type stripping,
// so relative imports name their `.ts` files.
import { analytics } from "@softure-ai/analytics";
import { attributeRegistration, countRegistration } from "@softure-ai/analytics/next";
import { auth, AUTH_RATE_LIMIT_BUCKETS } from "@softure-ai/auth";
import { billing, BILLING_RATE_LIMIT_BUCKETS, manual, stripe } from "@softure-ai/billing";
import { mailingResetSender } from "@softure-ai/auth/mailing";
import { defineSoftureConfig } from "@softure-ai/core";
import { registerSoftureConfig } from "@softure-ai/core/next";
import { featureSwitches } from "@softure-ai/feature-switches";
import { MCP_RATE_LIMIT_BUCKETS, mcpAccess } from "@softure-ai/mcp-access";
import { mailing, resend } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { ops } from "@softure-ai/ops";
import { privacy, PRIVACY_RATE_LIMIT_BUCKETS } from "@softure-ai/privacy";
import { recordRegistrationConsent } from "@softure-ai/privacy/server";
import { cloudflareIp, security } from "@softure-ai/security";
import { waitlist, WAITLIST_RATE_LIMIT_BUCKETS } from "@softure-ai/waitlist";
import { en } from "./messages/en.ts";
import { pl } from "./messages/pl.ts";
import { mailInvoiceRequestsTo } from "./lib/invoice-requests.ts";
import { rememberSignupChannel } from "./lib/signup-channels.ts";
import { guestbook } from "./modules/guestbook/index.ts";

/** The example's switch: a welcome line on the home page (e2e/feature-switches.spec.ts flips it). */
export const WELCOME_BANNER_SWITCH = "example.welcome_banner";

/** The example's initial admin (auth's `adminEmails`); e2e/auth-roles.spec.ts registers it. */
export const EXAMPLE_ADMIN_EMAIL = "e2e-admin@example.com";

// Registration hooks in the account's transaction: privacy records the consent, analytics hands
// over the channel the sign-up came from (e2e/analytics-channel.spec.ts) and counts the sign-up as
// the funnel's last step (e2e/analytics-funnel.spec.ts).
const recordConsent = recordRegistrationConsent();
const attributeChannel = attributeRegistration(({ userId, channel }) => {
  rememberSignupChannel(userId, channel);
});
const countSignup = countRegistration("signup");

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
      buckets: { "example.ping": { limit: 3, windowMinutes: 15 }, ...AUTH_RATE_LIMIT_BUCKETS, ...MCP_RATE_LIMIT_BUCKETS, ...PRIVACY_RATE_LIMIT_BUCKETS, ...WAITLIST_RATE_LIMIT_BUCKETS, ...BILLING_RATE_LIMIT_BUCKETS },
    }),
    // Reset links go out as mail through the mailing module below (e2e/auth-reset-mail.spec.ts).
    // The registration checkbox accepts the legal documents of privacy() below; the hook records
    // that consent with their versions, in the account's transaction (e2e/privacy-consents.spec.ts),
    // and the channel of a tagged sign-up is remembered for the account page.
    auth({
      routes: { afterLogin: "/account" },
      adminEmails: [EXAMPLE_ADMIN_EMAIL],
      passwordReset: { send: mailingResetSender() },
      onRegistered: async (event, ctx) => {
        await recordConsent(event, ctx);
        await attributeChannel(event, ctx);
        await countSignup(event, ctx);
      },
    }),
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
    // The legal documents and their versions: /legal/terms and /legal/privacy show them, and
    // registration records consent to them.
    privacy({
      documents: [
        { id: "terms", version: "2026-10-01" },
        { id: "privacy-policy", version: "2026-10-01" },
      ],
    }),
    // The form on the home page (e2e/waitlist.spec.ts): `launch` is required and tied to the privacy
    // policy, `newsletter` is optional; the welcome mail goes to the outbox like any list mail.
    waitlist({
      scopes: [
        { id: "launch", required: true, document: "privacy-policy", label: { en: en.waitlist.launch, pl: pl.waitlist.launch } },
        { id: "newsletter", label: { en: en.waitlist.newsletter, pl: pl.waitlist.newsletter } },
      ],
      placements: ["home"],
    }),
    // The channel tag `?z=` with its defaults; proxy.ts carries it from page to page. The funnel
    // counts the home page (a pixel), the account page (a beacon) and sign-ups (the hook above);
    // its endpoint is app/api/analytics/funnel/route.ts (e2e/analytics-funnel.spec.ts).
    analytics({
      funnel: {
        steps: [
          { id: "landing", via: "pixel" },
          { id: "account", via: "beacon" },
          { id: "signup", via: "server" },
        ],
      },
    }),
    // Entitlements at /account/billing (e2e/billing-entitlements.spec.ts): a 14-day trial from
    // registration, then read-only until a grant; the guarded write is app/account/billing/actions.ts.
    // Plans at /pricing and /payment, paid by invoice: a request mails the admin, who grants the
    // plan at /admin/billing (e2e/billing-pricing.spec.ts). BILLING_PROVIDER=stripe pays on Stripe
    // Checkout instead (STRIPE_SECRET_KEY); the webhook at app/api/billing/webhook/route.ts grants
    // and refunds either way (e2e/billing-stripe.spec.ts).
    billing({
      trial: { days: 14, reminderDays: 3 },
      paid: { reminderDays: 7 },
      plans: [
        {
          id: "monthly",
          name: { en: en.plans.monthly.name, pl: pl.plans.monthly.name },
          description: { en: en.plans.monthly.description, pl: pl.plans.monthly.description },
          price: { amount: 2900, currency: "PLN" },
          period: "month",
          features: en.plans.monthly.features.map((feature, index) => ({ en: feature, pl: pl.plans.monthly.features[index] })),
        },
        {
          id: "yearly",
          name: { en: en.plans.yearly.name, pl: pl.plans.yearly.name },
          description: { en: en.plans.yearly.description, pl: pl.plans.yearly.description },
          price: { amount: 29000, currency: "PLN" },
          period: "year",
          features: en.plans.yearly.features.map((feature, index) => ({ en: feature, pl: pl.plans.yearly.features[index] })),
          isFeatured: true,
        },
        {
          id: "lifetime",
          name: { en: en.plans.lifetime.name, pl: pl.plans.lifetime.name },
          description: { en: en.plans.lifetime.description, pl: pl.plans.lifetime.description },
          price: { amount: 79000, currency: "PLN" },
          period: "lifetime",
          features: en.plans.lifetime.features.map((feature, index) => ({ en: feature, pl: pl.plans.lifetime.features[index] })),
        },
      ],
      payment: process.env.BILLING_PROVIDER === "stripe" ? stripe() : manual({ onRequest: mailInvoiceRequestsTo(EXAMPLE_ADMIN_EMAIL) }),
    }),
  ],
});

registerSoftureConfig(config);
export default config;
