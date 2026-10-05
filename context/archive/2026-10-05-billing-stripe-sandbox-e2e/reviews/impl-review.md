# Implementation review: billing-stripe-sandbox-e2e

Reviewed: commits c277127..7a314de against plan.md @ 2026-10-05. Mode: quick (one phase).
Verdict: approve after fixes. Findings: 0 critical, 1 warning, 2 suggestions.

## Evidence

- `Stripe sandbox payment` job green twice on 7a314de, in the push run (37316856131) and the pull request run
  (37316885516), side by side on the same Stripe account: `1 passed (22.2s)`; the spec paid on
  `checkout.stripe.com`, read `paid` after Stripe's forwarded delivery, refunded through the API and read `trial`.
- `example app e2e` green and lists 119 tests in 26 files, without the sandbox spec (`playwright test --list`
  locally: 0 matches for `stripe-sandbox`); the sandbox config lists exactly the one spec.
- Gate step: run locally with an empty key (notice, `present=false`, exit 0), `sk_live_x` (error, exit 1),
  `sk_test_x` and `rk_test_y` (`present=true`) - plan-review W1.
- Gates: typecheck, lint (`eslint examples` with the example installed), language, `npm test`, `npm run build`
  green locally and in CI.

## Plan drift

None. All six steps landed as planned; no billing code changed, no version touched.

## Findings

### W1 [WARNING] The pinned Stripe CLI is far behind
**Where:** `.github/workflows/e2e.yml` (`STRIPE_CLI_VERSION`). The job's log: "A newer version of the Stripe
CLI is available, please update to: v1.53.0". 1.31.0 was a guess at a version that exists.
**Fix:** pin 1.53.0, the current release; the checksum step guards the download.
**Decision:** Fix now (applied in the archive commit; the job reruns on it before the merge).

### S1 [SUGGESTION] A foreign delivery logs "granted nothing (billing.account_unknown)"
**Where:** the job's server log. The parallel run's payment reached this run's server, as plan-review W2
expected; it answered 200 and the test passed in both runs.
**Decision:** Accepted - billing's documented behaviour; the log line is the owner's signal in production.

### S2 [SUGGESTION] Only the card in English is paid end to end
**Where:** spec. BLIK, Przelewy24 and a Polish Checkout are not driven.
**Decision:** Accepted - out of scope in plan.md; README §12 says so.

## Triage summary
Fixed: W1. Accepted: S1, S2. Deferred: -. Dismissed: -. Verdict after triage: approve.
