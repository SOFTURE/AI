# Research: billing-provider-adapter

Input: change.md, roadmap MO-3, research.sources (`docs/`). Depth: deep (money, webhooks, a migration).
Snapshot: 3eeb9e2 on claude/mo-3-billing-stripe-0aam5s (master after MO-2), 2026-10-03 15:55 Europe/Warsaw.

## Summary

- Billing already has the contract a provider plugs into: `PaymentProvider.startPayment` returns a
  redirect or `billing.payment_failed` (`modules/billing/src/payment.ts:44-53`), `startPayment` counts
  the `billing-payment` bucket and builds the absolute return URL (`server/plans.ts:83-99`).
- The one write a paid payment needs exists: `grantPlan` under the entitlement's row lock
  (`server/plans.ts:41-45`, `server/entitlements.ts:79-120`). It is not idempotent: two calls add two periods.
- A refund maps onto the existing `revoke` event, which clears paid and lifetime access
  (`entitlement.ts:58-59`); there is no event that removes exactly one period.
- Nothing stores provider payments today, and nothing receives webhooks. The repo's pattern for an
  outside service is a `fetch`-based adapter with an injectable `fetch` and the secret read per call
  (`modules/mailing/src/providers/resend.ts:28-34`), and for a provider callback a public route handler
  that checks a signature before the database (`modules/mailing/src/next/route.ts:26-35`).
- Owner decision: Stripe (2026-10-03). No Stripe credentials in this session; the sandbox can be
  reached only from CI once the owner adds `STRIPE_SECRET_KEY`.

## Current state

- Payment page → `startPaymentAction` (`next/actions.ts:39-56`) → `startPayment` (`server/plans.ts:83`):
  bucket, plan lookup, invoice details only when `provider.collectsInvoiceDetails`, then
  `provider.startPayment(ctx, { plan, account, invoice, returnUrl })`; a `redirect` result becomes
  Next's `redirect(url)` outside the try (`next/actions.ts:54`).
- `returnUrl` is the payment route on `config.appOrigin` without a plan parameter (`server/plans.ts:97`).
- `manual()` is the only provider (`manual.ts:17-30`); access comes from an admin's `grantPlanAction`.
- `grantPlan` → `changeEntitlement(ctx, userId, resolver)`: a transaction that takes `key share` on
  `auth.users`, then `for update` on `billing.entitlements` (`server/entitlements.ts:86-120`). The
  privacy erase takes `for update` on the account, then deletes the entitlement (`server/privacy.ts:74-75`).
- `Queryable` is a database or an open transaction (`foundation/db/src/client.ts:24`), so a server
  function called with `{ ...ctx, db: tx }` joins the caller's transaction (drizzle nests a savepoint).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Provider | `modules/billing/src/stripe.ts` (new), `src/index.ts` | `stripe()` implementing `PaymentProvider` |
| Webhook (pure) | `src/stripe-webhook.ts` (new) | signature and event parsing |
| Server | `src/server/payments.ts` (new), `server/index.ts`, `server/privacy.ts`, `server/health.ts` | record, refund, export, erase, health |
| Data | `migrations/0002_create_payments.sql` (new), `src/schema.ts`, `module.json` | payments table |
| Next | `src/next/route.ts` (new), `next/pages.tsx`, `next/index.ts` | webhook route, return notice |
| Copy | `src/messages/{en,pl}.ts` | checkout notices |
| Example | `examples/next-app/softure.config.ts`, `app/api/billing/webhook/route.ts`, `playwright.config.ts`, `e2e/` | wiring and e2e |
| CI | `.github/workflows/ci.yml` | sandbox key for the test job |

## Data

- `billing.entitlements` (`migrations/0001_create_entitlements.sql`): one row per account, FK to
  `auth.users` with cascade, `paid_until` and `is_lifetime` exclusive.
- No payments table. Migrations are per module with a ledger (`softure.migrations`); the example's
  `e2e/migrations.spec.ts:6-20` lists every applied migration and must gain the new one.
- The app runs as role `softure_app` (DML only), so the table needs no grants beyond the schema's defaults.

## Tests

- `modules/billing/tests/` on PGlite through `createTestBilling` (`tests/support.ts:47-52`); `npx vitest run modules/billing`.
- Route handlers are tested with `@softure-ai/core/next` and the context module mocked (`modules/mailing/tests/next-unsubscribe.test.tsx:15-35`).
- E2E: `examples/next-app/e2e/billing-*.spec.ts` against the built app; the server gets test secrets
  through `playwright.config.ts` `webServer.env`.
- Gap: no test reaches a real provider. A sandbox test needs the key in CI (`ci.yml` test job has none today).

## Patterns to follow

- Outside service adapter: options with `apiKey?`, `endpoint?`, `fetch?`; secret from env per call; log
  only the error's enum, never its message (`resend.ts:9-19`, `:66-75`).
- Public callback route: no rate limit when the caller is a few provider addresses; signature before
  the database; 500 on a database failure so the caller retries (`mailing/src/next/route.ts:1-35`).
- Small public bodies through `readSmallBody` (`modules/security/src/read-small-body.ts:20`).
- Manifest `env` entries and `mount` route handlers as in `modules/mailing/src/index.ts:24-46`; `module.json` mirrors the manifest (`tests/module.test.ts`).

## Prior work

- `context/archive/2026-10-03-billing-plans-pricing/plan.md`: the provider contract was shaped for a
  hosted checkout ("a hosted checkout (Stripe) is a redirect; `grantPlan` is its webhook's write").
- `context/archive/2026-10-03-billing-entitlements/`: `revoke` exists for "a refund, a mistaken grant" (`contract.ts:63-64`).
- FU-9 (`backlog/roadmap-followups/billing-admin-requests`): may share a payments table.

## SOFTURE modules

- **partially covered:** billing (entitlements, plans, provider contract), security (`readSmallBody`),
  privacy (contributors). The provider itself is this change.

## Risks

- Double grant on a repeated or duplicate delivery (Stripe retries until 2xx; `completed` and
  `async_payment_succeeded` can both arrive): high likelihood → a uniqueness constraint in the same transaction as the grant.
- Forged or replayed webhook granting access: → HMAC check with a timestamp tolerance before parsing.
- Deadlock between a refund, a grant and the privacy erase: → one lock order (account, payment, entitlement).
- A refund revoking more than one period, or a lifetime bought separately: medium → documented, followup.
- Secret leakage in logs (key, Stripe messages echoing the request): → log status and error type/code only.
- Live key in a test run creating real objects: → the sandbox test runs only with `sk_test_`/`rk_test_`.

## Relevant lessons

- L-001 (tsc builds): new files are plain TS; no bundler. L-002 (bare Next specifiers): the route imports nothing from Next.

## Answers to unknowns

- **Which provider:** Stripe (owner, 2026-10-03, cmsg_01V7bWY5L1K9uGx7qDFj2tKsN1vP6JZVzkANrjwnDTSkv1).
- **Webhook signature and replay protection:** Stripe signs `t.payload` with HMAC-SHA256 in
  `Stripe-Signature` (`t=…,v1=…`, several `v1` during rotation); a 300 s tolerance bounds replays;
  the database key bounds repeats inside the window.
- **Is a payment-events table needed:** a payments table keyed by checkout (and PaymentIntent) is
  needed; an event-id table is not, because two different events can carry one checkout.

## Open questions

- One-time payment or subscription: **decided** (auto, coordinator's default): one-time Checkout; `grantPlan` already stacks periods.
- E2E against the sandbox without credentials: **decided** (auto): signed fixtures in e2e; a Checkout API test against the sandbox runs in CI when the secret exists; the full browser payment is a followup.
- Partial refunds and per-period revocation: **decided** (auto): out of scope, followup.

## Decisions (auto)

- Depth `deep` (money, migration). Written on 2026-10-03 after a first uncommitted code draft had
  been started without it (the owner pointed out the skipped phase); the facts above are about
  master 3eeb9e2, and the draft is reviewed against this research and the plan review before commit.
