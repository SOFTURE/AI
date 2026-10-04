---
change_id: billing-existing-accounts
title: "Existing accounts keep their access when billing is enabled"
status: backlog
roadmap_item: FU-24
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app that turns billing on (FIRE_TRACKER first) keeps its existing users' access: known trial ends and paid periods are imported into `billing.entitlements`, accounts created before a chosen date can get a trial from that date instead of from their sign-up, derived trials can be pinned before a `trial.days` or time zone change, and the README says what each config change does to accounts without a row.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-24** (roadmap `followups`):

> ### FU-24: Existing accounts keep their access when billing is enabled
> - **Change ID:** `billing-existing-accounts`
> - **Status:** proposed
> - **Outcome:** An app that turns billing on (FIRE_TRACKER first) keeps its existing users' access: known trial ends and paid periods are imported into `billing.entitlements`, accounts created before a chosen date can get a trial from that date instead of from their sign-up, derived trials can be pinned before a `trial.days` or time zone change, and the README says what each config change does to accounts without a row.
> - **Prerequisites:** FU-22 on `master` (lane C).
> - **Unknowns:** An import format (ops script reading rows vs. a server function the app calls); whether the trial floor is an option (`trial.startsAt`) or only part of the import; how imported paid periods and lifetime access are recorded (manual grants vs. raw entitlement rows).
> - **Risk:** MEDIUM.
> - **Baseline:** monetization MO-1 `billing-entitlements`: a row-less account's trial starts at `auth.users.created_at`, so every account older than `trial.days` is read-only on the first read after billing is enabled; FIRE's `trial_ends_at` / `paid_until` have no import path; a change of `trial.days` or `config.timezone` moves every derived trial (README §5 names only `trial.days`). After: the gap is closed and covered by unit tests on PGlite and an e2e.
> - **PRD refs:** FR-22.
> - **Source:** FU-12 retro plan review of MO-1, W1 and W2 (`context/archive/2026-10-03-billing-entitlements/reviews/plan-review.md`); `modules/billing/src/server/entitlements.ts`, `modules/billing/README.md` intro and §5

## Constraints

- Owns: `modules/billing/` entitlement import and trial floor, its README sections (lane C, after FU-22).
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-12 (`billing-retro-reviews`, 2026-10-04).
