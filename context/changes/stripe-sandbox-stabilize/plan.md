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
- [ ] 4 root cause.
