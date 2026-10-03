---
project: "SOFTURE AI"
roadmap: later
version: 1
status: waiting
prd_version: 1
created: 2026-10-03
updated: 2026-10-03
backlog: context/backlog/roadmap-later/
trigger: "the owner step each item waits on (secrets, accounts) is done; the owner promotes it or takes single items"
---

# Roadmap later: items parked until an owner step is done

> Entries: [`context/backlog/roadmap-later/`](../../backlog/roadmap-later/). Queued roadmap (WORKFLOW §5.1):
> nothing here runs until the owner promotes it to `roadmap.md` (`softure-roadmap --promote later`) or moves a
> single item into the main roadmap.
>
> Parked work (owner, 2026-10-03): an item that is ready to build but waits only on something the owner does at the
> keyboard (repository secrets, a provider account) lands here instead of holding a module roadmap or waiting for
> the followups roadmap at the very end. Each item says in **Prerequisites** what it waits on. A new item gets the
> next `LT-` number, a backlog entry and a row.
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **LT-1** | `billing-stripe-sandbox-e2e` | Stripe sandbox payment end to end (was FU-10) | the owner's Stripe secrets | owner | blocked (the owner's Stripe test-mode secrets, set on 2026-10-05) |

## Order

1. **LT-1** once the owner has set the Stripe test-mode secrets (planned for Monday 2026-10-05).

## Items

### LT-1: Stripe sandbox payment end to end
- **Change ID:** `billing-stripe-sandbox-e2e`
- **Status:** blocked (the owner's Stripe test-mode secrets, set on 2026-10-05)
- **Outcome:** A browser payment on Stripe's sandbox Checkout (test card) whose webhook reaches the app (Stripe CLI forwarding or a reachable preview) and turns the trial into paid, run in CI when the Stripe test secrets are set.
- **Prerequisites:** the owner's Stripe test-mode secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) in the repository; the Stripe CLI or a public URL for the e2e server.
- **Unknowns:** How the webhook reaches a CI run (`stripe listen` in the job vs. a deployed preview); how stable Stripe's hosted page is for Playwright.
- **Risk:** MEDIUM.
- **Baseline:** monetization MO-3 `billing-provider-adapter`: the Checkout API is tested against the sandbox (`modules/billing/tests/stripe-sandbox.test.ts`, only with the key) and the webhook with signed fixtures (`e2e/billing-stripe.spec.ts`); no test pays in the sandbox and receives Stripe's own delivery (README §12). After: the gap is closed and covered by an e2e test.
- **PRD refs:** FR-22.
- **Source:** `modules/billing/README.md` §12; moved from followups FU-10 on 2026-10-03

## Owner decisions and checks

- [ ] **LT-1**: add the Stripe test-mode secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the repository
  (the owner, Monday 2026-10-05).

## Done

(nothing yet)

## Decisions (auto)

- FU-10 moved here from followups as LT-1 (owner, 2026-10-03). → It waits only on the owner's Stripe secrets, so it
  can run as soon as they are set instead of after every module roadmap.
