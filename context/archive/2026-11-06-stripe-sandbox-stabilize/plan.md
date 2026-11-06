# Plan: stripe-sandbox-stabilize

## Steps

1. `scripts/ci/affected.mjs`: an area may carry `sharedPaths` that replace `SHARED_PATHS`; add the `stripe-sandbox`
   area (paths: `modules/billing/`, `examples/next-app/app/payment/`, `examples/next-app/app/api/billing/`, the spec,
   its config; shared: `.github/workflows/e2e.yml`, `.github/actions/`).
2. `e2e.yml`: `changes` outputs `stripe-sandbox`; the job gates on it; a nightly `schedule`.
3. `tests/repo/ci-affected.test.ts`: billing and the payment pages reach the area, the lockfile and root configs do
   not, the workflow does.
4. Root cause: read the diagnostic step's output, fix billing or the test, prove it with a green Stripe job.

## Acceptance

- `npx vitest run tests/repo/ci-affected.test.ts` passes.
- The PR's `changed areas` job prints `stripe-sandbox=true` (it changes e2e.yml) and the Stripe job is green.

## Progress

- [x] 1-3 implemented; 31 area tests pass; ci-workflows test allows e2e.yml's nightly schedule.
- [x] 4 root cause: Stripe's side. Run 128018303179 (16:47): every Checkout Session since 15:20 stayed `open` with no PaymentIntent, so Checkout's own confirm call failed before a payment existed; nothing in billing or the test changed. Run 128026785732 (16:59, head 7e6e35b) on the same billing code paid, got `checkout.session.completed` and the refund: passed in 20.9s. No billing change, so no release. The test keeps the diagnostics (page alerts, Stripe API errors, recorded sessions/PaymentIntents/charges) so a future outage names itself in the log.
