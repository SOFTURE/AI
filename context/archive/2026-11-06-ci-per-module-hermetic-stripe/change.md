---
change_id: ci-per-module-hermetic-stripe
title: "ci: no pull request depends on live Stripe, and every package triggers only its own checks"
status: archived
archived_at: 2026-11-06
roadmap_item: null
issue: null
branch: claude/project-thread-89civn
created: 2026-11-06
updated: 2026-11-06
---

## Intent

The owner's two orders after the Stripe sandbox outage of 2026-11-06 (15:20-16:50 UTC), which turned unrelated pull
requests red:

1. Tests must not depend on external infrastructure. The Stripe payment flow is tested against a local fake Stripe on
   every change. The live Stripe sandbox tests are removed (the owner, 18:38 UTC: no value in them, nightly included).
2. Every package triggers only its own tests and its dependents'. A lockfile change (a release's version bump, a
   dependency update) reaches only the packages whose installed tree changed, not every area.

## Notes

- Research: skipped. The mechanisms exist (`scripts/ci/affected.mjs`, `stripe({ apiBase })`, signed webhook fixtures);
  the measurements are the outage runs of stripe-sandbox-stabilize and the lockfile diffs of recent merges.

## Decisions (auto)

- The fake Stripe is a small Node server in the example app's e2e (`e2e/fake-stripe-server.mjs`), not recorded HTTP
  replays: Checkout is a browser flow plus webhooks, which a replay cannot drive.
- billing accepts a plain-HTTP checkout page only when `apiBase` is itself a plain-HTTP loopback server; everything
  else still needs HTTPS. Released as a patch.
- Pull requests run scoped unit tests; a push to master and a manual run keep the whole suite as the safety net.
- A root tool (a root `devDependencies` entry or anything only the root resolves) or the root lockfile entry still
  reaches everything: it serves every package's checks.

## Done

Pull requests no longer talk to Stripe: the example e2e pays through a local fake Stripe (checkout, payment, signed
webhook, refund; CI run on c66b7ed: `fake-stripe` passed, 129 passed). The live sandbox tests (billing's
`stripe-sandbox.test.ts`, the example's `billing-checkout.stripe-sandbox.spec.ts` and its config) are deleted and no
workflow reads a Stripe key. A lockfile change reaches only the packages whose entries changed, and a
pull request's unit tests run only for the packages it reaches plus `tests/`. billing accepts a loopback HTTP test
server's checkout page (released as a patch).
