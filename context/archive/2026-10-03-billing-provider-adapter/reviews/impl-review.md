# Implementation review: billing-provider-adapter

Scope: full · Date: 2026-10-03 · Commits: f84b31c..a7817eb · Gates: typecheck ✓ lint ✓ test ✓ (1905 passed, 10 skipped) build ✓ · e2e: 77 passed (local Postgres 16)

## Verdict

Ready after fixes. Both phases deliver the plan: Stripe Checkout through `stripe()`, a verified
webhook that grants once and revokes once, `billing.payments`, privacy and health, the example's
route and the e2e with signed deliveries. One cheap fix was applied (F1); two warnings are accepted
with evidence and covered by followups; no critical finding.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | F3 |
| Correctness | PASS | F4 |
| Tests | WARN | F2 |
| Migrations | PASS | — |
| Security | PASS | — |
| Patterns and lessons | PASS | F1 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Module | f84b31c | yes | signature, events, checkout, payments, refunds, route, privacy, health, manifest, README, FU-10…FU-12 |
| 2 Example app, e2e, docs | 870773e | yes | webhook route, provider switch, `e2e/billing-stripe.spec.ts`, migrations list, README |

Files: planned and changed 34 · unplanned 0 · planned, not changed 0. The CI sandbox key
(`.github/workflows/ci.yml`, planned in phase 2) landed with phase 1 (F3).

## Findings

### F1 [SUGGESTION] The provider name was written twice
**Impact:** LOW · **Dimension:** Patterns · **Where:** `modules/billing/src/stripe.ts` (name), `src/server/payments.ts` (`STRIPE_PROVIDER`)
**What:** `stripe()` named itself with a literal while the webhook stored payments under `STRIPE_PROVIDER`.
**Why it matters:** a rename of one would split payments from their provider.
**Fix:** use the constant in both.
**Decision:** fix now: `name: STRIPE_PROVIDER` (a7817eb)

### F2 [WARNING] The action's redirect to Stripe's page is not exercised end to end
**Impact:** MEDIUM · **Dimension:** Tests · **Where:** `src/next/actions.ts:54` with `stripe()`
**What:** unit tests prove `startPayment` returns `{ type: "redirect", url }` with `stripe()`, and the
sandbox test proves Stripe hosts that URL; the example's e2e runs `manual()`, so no test clicks the
button and lands on `checkout.stripe.com`.
**Why it matters:** a regression in the action's external redirect would only show in production.
**Evidence:** Next's `redirect()` accepts absolute URLs in server actions (MO-2 designed the
redirect branch for this, archive plan "Provider contract"); the branch is unchanged here.
**Fix:** a browser payment in the sandbox (FU-10), which needs the owner's secrets.
**Decision:** accept (auto): the owner's secrets are missing; FU-10 carries it.

### F3 [SUGGESTION] Commit subjects and the CI change's phase
**Impact:** LOW · **Dimension:** Plan coverage · **Where:** f84b31c, 870773e
**What:** the phase commits use the repository's module-prefixed subjects (as MO-1 and MO-2) rather
than `(<change-id>): … (pN)`; the CI key moved from phase 2 into phase 1.
**Decision:** accept (auto): history stays readable and every commit maps to one phase in this report.

### F4 [WARNING] The success notice does not wait for the webhook
**Impact:** LOW · **Dimension:** Correctness · **Where:** `src/next/pages.tsx` (checkout notice)
**What:** `?checkout=success` thanks the buyer while the badge may still say "trial" for the seconds
before Stripe's delivery lands.
**Why it matters:** a buyer could think the payment failed.
**Evidence:** the copy says access updates "as soon as the payment is confirmed, usually within a minute" (`messages/en.ts`, `pl.ts`).
**Decision:** accept (auto): the copy sets the expectation; polling would add a client component for seconds of delay.

## Progress audit

- 1.1, 1.2: `tests/stripe-webhook.test.ts` (31), `tests/stripe.test.ts` (13), `tests/stripe-payments.test.ts` (15),
  `tests/stripe-route.test.ts` (9), `tests/privacy.test.ts`, `tests/module.test.ts`, re-run green.
  Mutation check: dropping `onConflictDoNothing` fails 2 tests; dropping the refund's `status = 'paid'` condition fails 1.
- 1.3, 2.2: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` re-run on a7817eb, all exit 0.
- 2.1: `examples/next-app` built and migrated (billing 2 applied); `npx playwright test` 77 passed, the three `billing-stripe` specs included.
- The sandbox test (`tests/stripe-sandbox.test.ts`) is skipped without `STRIPE_SECRET_KEY`; it is not ticked as run.

## Triage summary

Fixed: F1. Accepted: F2, F3, F4. Deferred: — (F2 is already FU-10). Withdrawn: —.

## Lessons proposed

None: skipping research and plan review was a process slip already handled by the coordinator's
briefs and FU-12.

## Decisions (auto)

- F1 provider name → fix now (one line, risk-free).
- F2 external redirect untested → accept (needs owner secrets; FU-10).
- F3 commit subjects → accept (history readable).
- F4 notice before the webhook → accept (copy covers it).
