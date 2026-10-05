# Plan review: billing-stripe-sandbox-e2e

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready after fixes.
Findings: 0 critical, 2 warnings, 1 suggestion.
Grounding: 8/8 paths (`modules/billing/src/stripe.ts`, `modules/billing/src/next/route.ts`,
`examples/next-app/softure.config.ts`, `examples/next-app/playwright.config.ts`,
`examples/next-app/e2e/billing-stripe.spec.ts`, `examples/next-app/e2e/database.ts`,
`.github/workflows/e2e.yml`, `modules/billing/README.md`), 4/4 symbols (`stripe`, `stripeWebhookRoute`,
`STRIPE_WEBHOOK_SECRET_ENV`, `payments`), 4/4 commands (`workflow.json` gates, `npm run build`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (pay, Stripe's delivery, paid; refund, delivery, trial) |
| Slicing | PASS (one phase) |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (no schema change) |
| Tests | PASS |
| Security | WARN (W2) |
| Lean | PASS (no billing code change, one job) |
| Fit | PASS (follows `billing-stripe.spec.ts` and the `e2e` job) |
| Cost and defaults | PASS (a test-mode refund costs nothing) |
| Scope | PASS (versions and publishing left to the release thread) |
| Reuse | PASS (`openTestDatabase`, the register flow) |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### W1 [WARNING] The live-key refusal cannot be shown in CI
**Effort:** low. **Lens:** Verifiability. **Where:** Progress 1.3.
**Problem:** the repository holds a test key, so the gate's "live key fails" branch never runs in CI.
**Fix:** the gate is a `case` on the key's prefix; check it by running the same script locally with
`sk_live_x`, an empty value and `sk_test_x`, and say so in the impl review.
**Decision:** Fix now (applied) - item 1.3 is checked by running the gate script locally.

### W2 [WARNING] Other runs' deliveries reach this run's server
**Effort:** low. **Lens:** Security. **Where:** Approach, Webhook path.
**Problem:** `stripe listen` forwards every event of the account, including another branch's payment
and refund and the `ci.yml` sandbox test's sessions.
**Fix:** none in code: the route answers 200 for a paid checkout whose account it does not know and a
refund of a payment it never recorded (`modules/billing/src/next/route.ts`, README §12 first line);
the session test's `checkout.session.expired` is not in `--events`. Recorded in research §How the
webhook reaches CI.
**Decision:** Accepted - behaviour already defined by billing.

### S1 [SUGGESTION] Pin the Stripe CLI version
**Effort:** low. **Lens:** Security. **Where:** step 4.
**Problem:** an unpinned "latest" download changes under the job without a commit.
**Fix:** pin the version in an env of the job and verify the tarball against the release's checksums file.
**Decision:** Fix now (applied) - the Key decisions row says pinned and sha256 checked.

## Triage summary
Fixed: W1, S1. Accepted: W2. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- W2 → Accept (billing already answers 200 for foreign deliveries; nothing to change).
