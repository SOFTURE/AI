---
change_id: billing-existing-accounts
title: "Existing accounts keep their access when billing is enabled"
status: plan_reviewed
roadmap_item: FU-24
branch: claude/fu-24-billing-existing-accounts-ijtwes
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app that turns billing on for a user base it already has (FIRE_TRACKER first) keeps those users'
access: an operator imports known trial ends, paid periods and lifetime access into
`billing.entitlements`, the config can give accounts created before a chosen day a trial that starts
on that day, an operator can pin every derived trial into a row before changing `trial.days` or the
time zone, and the README says what each of those config changes does to accounts without a row.
Unit tests on PGlite and an e2e cover it.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-24).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-24** (roadmap `followups`):

> - **Outcome:** An app that turns billing on (FIRE_TRACKER first) keeps its existing users' access: known trial ends and paid periods are imported into `billing.entitlements`, accounts created before a chosen date can get a trial from that date instead of from their sign-up, derived trials can be pinned before a `trial.days` or time zone change, and the README says what each config change does to accounts without a row.
> - **Unknowns:** An import format (ops script reading rows vs. a server function the app calls); whether the trial floor is an option (`trial.startsAt`) or only part of the import; how imported paid periods and lifetime access are recorded (manual grants vs. raw entitlement rows).
> - **Baseline:** monetization MO-1 `billing-entitlements`: a row-less account's trial starts at `auth.users.created_at`, so every account older than `trial.days` is read-only on the first read after billing is enabled; FIRE's `trial_ends_at` / `paid_until` have no import path; a change of `trial.days` or `config.timezone` moves every derived trial (README §5 names only `trial.days`). After: the gap is closed and covered by unit tests on PGlite and an e2e.
> - **Source:** FU-12 retro plan review of MO-1, W1 and W2 (`context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md`); `modules/billing/src/server/entitlements.ts`, `modules/billing/README.md` intro and §5

The source findings, quoted from that review:

> **W1** Existing accounts are read-only the moment billing is enabled, and there is no import path.
> **Fix:** A way to adopt existing accounts: an import of known trial ends and paid periods (rows
> written through `changeEntitlement`), plus an optional trial floor for accounts created before a
> given date; correct the README sentence.

> **W2** A config change silently moves every derived trial. **Fix:** Document all three effects, and
> offer a pin step (write the derived trial into rows) that the same import tool as W1 can run.

## Constraints

- Owns `modules/billing/` (entitlement import, trial floor, pin step, scripts, README §1, §3, §4, §5,
  §12) and the example app's billing scripts and e2e. Lane C: FU-25 and later billing items are not
  done here; other gaps go to the followups roadmap as new FU items.
- FIRE_TRACKER is read-only and outside this session's repository scope: this change ships the tool,
  FIRE's own roadmap runs the import.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish (owner).

## Notes

- Research: kept (money and existing data are involved; it answers the three unknowns).
- Framing skipped: the problem and its fix are stated by the retro review (W1, W2) and the roadmap
  item; the scope is not in doubt.
