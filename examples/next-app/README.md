# Example app (Next.js)

A Next.js 16 app built from `@softure-ai/core`, `@softure-ai/db`, `@softure-ai/ui` and the modules, and the
end-to-end harness of the repository: every module adds its scenarios here
([roadmap FD-7](../../context/foundation/archive/2026-10-02-roadmap.md)).

It installs the foundation packages the way an app gets them from npm: `.npmrc` sets
`install-links`, so `npm ci` packs `../../foundation/*` (their `files` and `exports`, built
`dist/` included) and installs copies, not symlinks. A file a package forgets to publish breaks
this app before it breaks a user.

## Run the e2e

```bash
npm run e2e            # at the repository root
```

[`scripts/e2e.mjs`](scripts/e2e.mjs) builds every package, reinstalls this app, starts Postgres
from [`compose.yaml`](compose.yaml) (port 5433) unless `DATABASE_URL` is set, runs
`softure migrate`, `next build`, and Playwright against `next start`. CI runs the same steps in
[`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) on a Postgres service container.
With a Chromium already on the machine, `PLAYWRIGHT_CHROMIUM_PATH=<path>` skips Playwright's download.

The `context/workflow.json` key `integration.local` names this command, so orchestrators run it
before a change is ready.

## Run the container check

```bash
npm run e2e:container  # at the repository root; needs Docker
```

[`scripts/container.mjs`](scripts/container.mjs) builds the image from the repository root, starts
Postgres with the roles of `modules/ops/recipes/initdb/`, migrates as the migrator, serves as the app
role, and checks `GET /api/health`: 200 with every check, the app role refused DDL, then 503 with
Postgres stopped. CI runs it as the `container` job of `.github/workflows/e2e.yml`.

## Pay in Stripe's sandbox

```bash
stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to localhost:3200/api/billing/webhook   # in one terminal
STRIPE_WEBHOOK_SECRET="$(stripe listen --api-key "$STRIPE_SECRET_KEY" --print-secret)" \
  npm run e2e:stripe-sandbox   # in examples/next-app, after `npm run e2e` built the app
```

[`e2e/billing-checkout.stripe-sandbox.spec.ts`](e2e/billing-checkout.stripe-sandbox.spec.ts) pays the
monthly plan on Stripe's hosted Checkout with the test card, waits for Stripe's own delivery to turn the
trial into paid access, then refunds through Stripe's API and waits for the access to go. It runs from
[`playwright.stripe-sandbox.config.ts`](playwright.stripe-sandbox.config.ts) on port 3200 with
`BILLING_PROVIDER=stripe`, needs a test-mode `STRIPE_SECRET_KEY` (`sk_test_...`) and the Stripe CLI, and
is skipped without the key. CI runs it as the `stripe-sandbox` job of `.github/workflows/e2e.yml` when the
repository has the `STRIPE_SECRET_KEY` secret. `npm run e2e` does not run it.

## Develop

```bash
npm run build                          # at the root, after changing a package
cd examples/next-app && npm ci         # picks up the new dist/
docker compose up --detach --wait
npm run migrate
npm run dev
```

`DATABASE_URL`, `APP_ORIGIN` and `APP_LOCALE` (`en` or `pl`) come from the environment; see
[`.env.example`](.env.example). `next dev` reads `.env.local`, `npm run migrate` reads the shell.

## What is in it

| Path | What it shows |
| --- | --- |
| `softure.config.ts` | `defineSoftureConfig` with the guestbook, `@softure-ai/security`, `@softure-ai/auth` and the other modules, registered for package code |
| `instrumentation.ts` | the config imported at server start (Node.js runtime only) |
| `modules/guestbook/` | a module defined in the app: manifest, `migrations/0001_create_entries.sql`, drizzle tables, queries returning `Result` |
| `app/layout.tsx` | `ThemeScript`, `SoftureThemeProvider`, `ToastHost` |
| `app/page.tsx` | `ThemeSwitch`, `Card`, `EmptyState`, the guestbook and the `softure.migrations` ledger |
| `app/add-entry.tsx`, `app/actions.ts` | `Modal` with an `ActionForm` posting to a server action validated with zod |
| `app/login/`, `app/register/`, `app/account/password/`, `app/api/auth/session/` | pages and a route handler shipped by `@softure-ai/auth`, each mounted with one re-export line |
| `proxy.ts`, `app/account/page.tsx` | the auth guard keeping `/account` private, then the channel piece of `@softure-ai/analytics` (`channels.carry(request, guard(request)) ?? channels.tag(request)`); an app page with `requireUser`, `LogoutButton`, the channel the account signed up from and the funnel's `account` beacon (`<FunnelBeacon>`) |
| `app/forgot-password/`, `app/reset-password/` | password reset pages shipped by `@softure-ai/auth`; the links go out as mail through `mailingResetSender()` from `@softure-ai/auth/mailing` and the mailing module (the fake provider's outbox in the e2e) |
| `app/admin/`, `app/api/admin/status/`, `scripts/grant-role.ts`, `scripts/revoke-role.ts` | an admin-only page, action and route handler (`requireRole`, `authorizeRole`; the admin is `EXAMPLE_ADMIN_EMAIL` in `adminEmails`), and the role scripts (`npm run grant-role -- --email=… --role=admin --commit`) |
| `app/switches/page.tsx`, the welcome banner in `app/page.tsx` | the admin-only panel of `@softure-ai/feature-switches` mounted with one re-export line at `/switches`, and `isEnabled("example.welcome_banner")` read on the home page |
| `app/account/mcp/page.tsx`, `app/api/mcp/route.ts`, `lib/mcp-server.ts` | the token page of `@softure-ai/mcp-access` and its MCP endpoint around the example's server (`whoami`, `list_entries`, and `sign_guestbook` for write tokens), each mounted with one line |
| `app/account/mail/`, the `mailing(...)` entry in `softure.config.ts` | `sendMail` of `@softure-ai/mailing` from a server action, to the signed-in user's own address; `resend()` when `RESEND_API_KEY` is set, else the fake provider writing to the e2e outbox file (`MAIL_OUTBOX`, set by `playwright.config.ts`); the newsletter option sends it as list mail |
| `app/unsubscribe/`, `app/api/mailing/unsubscribe/` | the unsubscribe page and the RFC 8058 one-click route shipped by `@softure-ai/mailing`, each mounted with one re-export line; links are signed with `MAILING_UNSUBSCRIBE_SECRET` |
| `app/account/privacy/`, `app/api/privacy/export/` | the export link and account deletion page and the JSON export route of `@softure-ai/privacy`, each mounted with one re-export line; auth, feature-switches, mcp-access, privacy's consents, the waitlist and billing contribute their data |
| `app/legal/`, the footer in `app/layout.tsx`, `onRegistered` in `softure.config.ts` | the terms and privacy policy rendered by `LegalDocument` from the app's copy (`messages/`) with the versions of `privacy({ documents })`, `LegalFooter` on every page, and `recordRegistrationConsent()` recording consent to both documents at registration |
| `<Waitlist placement="home" />` in `app/page.tsx`, the `waitlist(...)` entry in `softure.config.ts` | the form of `@softure-ai/waitlist` in one line: a required `launch` scope tied to the privacy policy and an optional `newsletter`; with double opt-in, a sign-up counts once the link in its confirmation mail is used (`app/waitlist/confirm/`, one re-export line); then consents land in `privacy.consents` and the welcome mail goes out once as list mail with mailing's unsubscribe link |
| the `analytics()` entry and the `onRegistered` hook in `softure.config.ts`, `lib/signup-channels.ts` | the `?z=` tag of `@softure-ai/analytics` handed to auth's hook by `attributeRegistration`; the demo keeps it in process memory (a real app saves it in its own table or counts it); `countRegistration("signup")` counts every sign-up in the funnel |
| `app/api/analytics/funnel/route.ts`, `<FunnelPixel step="landing" />` in `app/page.tsx` | the funnel endpoint of `@softure-ai/analytics` (beacon and pixel), mounted with one line, and the home page counted by a pixel |
| `app/account/billing/`, the `billing(...)` entry in `softure.config.ts` | `CurrentAccessBadge` and `CurrentAccessNotice` of `@softure-ai/billing` in one line each, and a write guarded by `requireWriteAccess`: a new account is on a 14-day trial, a read-only one gets `billing.read_only` and writes nothing |
| `app/pricing/`, `app/payment/`, `app/admin/billing/`, `lib/invoice-requests.ts` | the plans of `billing({ plans })` as `<Pricing />` on a public page, `PaymentPage` and `BillingAdminPage` mounted with one re-export line each, and `manual({ onRequest })` mailing each invoice request to the admin once (asking again only refreshes it), who grants the plan at `/admin/billing` |
| `app/api/billing/webhook/`, `BILLING_PROVIDER` | `stripeWebhookRoute` of `@softure-ai/billing` in one re-export line: a signed Stripe delivery grants a paid checkout's plan once and a full refund takes it back; `BILLING_PROVIDER=stripe` pays on Stripe Checkout (`STRIPE_SECRET_KEY`) instead of by invoice |
| `scripts/grant-plan.ts`, `scripts/revoke-grant.ts` | the plan scripts of `@softure-ai/billing/scripts` for a host without the admin page: `npm run grant-plan -- --email=… --plan=monthly --commit` records a manual grant in the account's history, `npm run revoke-grant -- --email=… --grant=<id> --commit` takes one back (a dry run lists the account's active grants and their ids) |
| `scripts/import-entitlements.ts`, `scripts/pin-trials.ts` | the existing-account scripts of `@softure-ai/billing/scripts`: `npm run import-entitlements -- --file=entitlements.json --commit` records the trial ends, paid periods and lifetime access another system knew (by email, never shortening access), `npm run pin-trials -- --commit` writes every derived trial into a row before `trial.days` or the time zone changes |
| `scripts/send-access-reminders.ts` | `sendAccessReminders` of `@softure-ai/billing/mailing` as a script a scheduler runs daily (`npm run access-reminders`): accounts whose trial or paid access ends soon or has just ended get one mail per window |
| `scripts/expire-invoice-requests.ts` | `expireStaleRequests` of `@softure-ai/billing/server` as a script a scheduler runs daily (`npm run expire-invoice-requests`): invoice requests nobody asked again for in 30 days close as `expired` and lose their invoice details |
| `app/api/security/ping/route.ts` | a public route handler: `identifyClient`, `consumeRateLimit` and `readSmallBody` from `@softure-ai/security` |
| `app/api/health/route.ts` | `GET /api/health` of `@softure-ai/ops`, one line; the guestbook contributes a check (`modules/guestbook/health.ts`) |
| `app/robots.ts`, `app/sitemap.ts`, `app/indexnow-key.txt/route.ts`, the `seo(...)` entry in `softure.config.ts`, `htmlLimitedBots` in `next.config.ts` | `@softure-ai/seo`: robots.txt naming the AI crawlers with the account, admin and API paths closed in every group, a sitemap of the public pages and, through `blogSitemap()`, the blog's texts with their dates, the IndexNow key file; each file one import and a default export, dynamic so the origin is `APP_ORIGIN` at runtime |
| `app/blog/`, `content/blog/`, `scripts/blog.ts`, the `blog(...)` entry in `softure.config.ts`, the first line of `proxy.ts` | `@softure-ai/blog`: the listing, articles with "read next", glossary, method page, OG card and the RSS feed (`app/blog/rss.xml/route.ts`) and the cache refresh a committed publish calls (`app/api/blog/refresh/route.ts`, `BLOG_REFRESH_SECRET`), each page one re-export with the app's CTA and `<Waitlist placement="blog" />` passed as slots; the proxy piece answers 301 for old slugs and 410 for withdrawn texts; `npm run blog:publish` previews the sync of `content/blog/`, `npm run blog:fixtures` publishes it with the renamed fixture of `e2e/fixtures/blog-renamed/` (`--no-indexnow`: a local publish pings no search engine); the texts are short fixtures, so `quality: false` |
| `Dockerfile`, `compose.container.yaml`, `scripts/migrate.ts` | the ops container recipe: one image, a one-off migrate step as the migrator role, the app as the app role |
| `messages/` | the app's `en` and `pl` copy; no text is written inline |
| `e2e/` | Playwright: theme switch, modal and form, migrations, security, auth, password reset, roles, switches, mail, reset mail, unsubscribe, MCP access, privacy export and deletion, legal pages and consents, waitlist, channel tags, billing entitlements, plans and the manual payment flow, the Stripe webhook (and, with the sandbox key, a real Stripe payment), reminder mail, the funnel, robots.txt, sitemap and the IndexNow key file, the blog's pages, feed, sitemap entries and "read next", 301 and 410, and a publish that shows on a cached page at once |

## Adding a scenario

1. Use the module in the app (its package as a `file:` dependency, listed in `softure.config.ts`).
2. Add `e2e/<module>.spec.ts`. Read copy from the dictionaries, not literals; a test that writes
   data deletes it at the end (see `e2e/guestbook.spec.ts`).
3. `npm run e2e` at the root.

## Known limits

- A module's `migrations: { dir: new URL("./migrations/", import.meta.url) }` fails `next build`:
  Turbopack resolves a literal `new URL(…, import.meta.url)` as a file and finds a folder.
  `modules/guestbook/index.ts` passes `import.meta.url` through a value Turbopack does not follow.
  Recorded in [`context/backlog/next-integration.md`](../../context/backlog/next-integration.md).
- The bundle resolves packages only inside this folder (`turbopack.root` in `next.config.ts`), so a
  file missing from a packed copy fails `next build`. TypeScript has no such limit: when a packed
  copy lacks its `.d.ts`, `tsc` walks up to the repository's `node_modules` and finds the workspace
  package. The release pack check (`npm run release:pack`) covers declaration files.
- Root `npm run lint` lints this app whenever `node_modules` exists here. An install older than a
  package change can then fail lint over code that is fine; `npm run e2e` reinstalls it.
- No authentication: the server action has no user to authorize, and nothing is rate-limited. It is
  a test fixture, not a deployable app.
