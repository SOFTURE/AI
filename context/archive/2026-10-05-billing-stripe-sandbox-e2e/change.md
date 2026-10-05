---
change_id: billing-stripe-sandbox-e2e
title: "Stripe sandbox payment end to end"
status: archived
roadmap_item: LT-1
branch: claude/project-thread-5vljv7
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

A Playwright test pays for a plan on Stripe's sandbox Checkout with a test card, Stripe's own webhook
delivery reaches the example app through `stripe listen`, and the account's trial turns into paid
access; a refund made through Stripe's API then comes back the same way and takes the access back. It
runs in CI as its own job whenever the repository has `STRIPE_SECRET_KEY` (a test-mode key), and skips
with a notice otherwise. A reviewer checks the `stripe sandbox` job of the e2e workflow: green on this
branch, with the paid status read from the app after Stripe's delivery, not after a signed fixture.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item LT-1, taken 2026-10-05).

## Context

From [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), item **LT-1**:

> - **Outcome:** A browser payment on Stripe's sandbox Checkout (test card) whose webhook reaches the app (Stripe CLI forwarding or a reachable preview) and turns the trial into paid, run in CI when the Stripe test secrets are set.
> - **Unknowns:** How the webhook reaches a CI run (`stripe listen` in the job vs. a deployed preview); how stable Stripe's hosted page is for Playwright.
> - **Risk:** MEDIUM.

Owner step done: the owner added `STRIPE_SECRET_KEY` (a `sk_test_` key) to the repository secrets on
2026-10-05. `STRIPE_WEBHOOK_SECRET` is not a repository secret: the job takes the signing secret of its
own `stripe listen` session (`stripe listen --print-secret`), which is the secret Stripe signs the
forwarded deliveries with (coordinator brief, 2026-10-05).

## Constraints

- Owns: a new Stripe sandbox spec and Playwright config in `examples/next-app/`, a new job in
  `.github/workflows/e2e.yml`, billing's README §12 line on LT-1, and the LT-1 rows of the later roadmap.
- No change to `@softure-ai/billing`'s code or to package versions: a parallel thread prepares the
  0.1.0 versions for the first publish.
- The existing e2e suite keeps playing Stripe with signed fixtures and runs without any secret.
- Never a live key: the spec and the job refuse anything but `sk_test_`/`rk_test_`.
- English-only code, comments and commits (AGENTS.md). Gaps found on the way go to the later roadmap as
  new `LT-` items, not fixed here.

## Notes

- Placement: queued roadmap `later`, item LT-1, taken on its own (owner step done).
- Research: short, on the two unknowns of the item (how the webhook reaches CI, how to drive the hosted
  page) and on what the existing harness gives.
- Framing skipped: the problem and the outcome are fixed by the roadmap item and billing's README §12;
  the only open questions are technical and the research answers them.
- Archived 2026-10-05: the `stripe-sandbox` job of `.github/workflows/e2e.yml` pays in Stripe's sandbox
  (`examples/next-app/e2e/billing-checkout.stripe-sandbox.spec.ts`) and receives Stripe's own deliveries through
  `stripe listen`; green on the branch, also with two runs on the same account at once.
