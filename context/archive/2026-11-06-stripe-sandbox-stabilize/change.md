---
change_id: stripe-sandbox-stabilize
title: "e2e: the Stripe sandbox payment runs only for billing changes and nightly, and passes again"
status: archived
archived_at: 2026-11-06
roadmap_item: null
issue: null
branch: claude/project-thread-89civn
created: 2026-11-06
updated: 2026-11-06
---

## Intent

The `Stripe sandbox payment` job pays in a real Stripe sandbox. It ran on every pull request that reached the example
app, and through the shared lockfile that is almost every pull request (a release's version bump included). Since about
15:20 UTC on 2026-11-06 it fails on every run with no change on our side, so unrelated pull requests turn red.

1. Give the job its own CI area: it runs on a pull request only when the change touches `@softure-ai/billing`, the
   example app's payment pages and webhook, the test and its Playwright config, or its workflow; and every night on a
   schedule, so a change on Stripe's side still shows within a day.
2. Find the cause of the failure (carrying #1161's diagnostics) and fix it in billing or the test.

## Notes

- Research and framing: skipped for part 1 (the area mechanism exists, `scripts/ci/affected.mjs`; the change adds one
  area with its own shared paths). Part 2's research is the diagnostic run's log.
- Carries #1161's commit (diagnostics, PLN pick reverted); #1161 is closed in favour of this pull request.

## Decisions (auto)

- The area does not follow billing's workspace dependencies or the root shared files: a change there cannot change what
  Stripe answers, and the nightly run covers it.
- The nightly schedule runs the whole e2e workflow (a scheduled run reaches every area), which also catches drift in
  other external tools.

## Finding

The failure from about 15:20 to about 16:50 UTC was on Stripe's side: every Checkout Session in that window stayed
`open` with no PaymentIntent (Checkout's confirm call failed before a payment existed), while billing and the test were
unchanged. The same code paid at 16:59 (run 128026785732). Billing needs no change and no release.

## Done

The Stripe sandbox payment runs on a pull request only when it changes billing, the example app's payment page or
billing webhook, the test, its config or its workflow, and every night at 03:17 UTC; the lockfile and root configs no
longer reach it. A failed run names Stripe's API errors, the page's alerts and what Stripe recorded.
