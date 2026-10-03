---
change_id: billing-entitlements
title: "Entitlements and the write guard"
status: backlog
roadmap_item: MO-1
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

A pure entitlement state machine (`trial | paid | read_only`) with trial length and reminder windows from config; `billing.entitlements` (one row per user, separate from `auth.users`); `getEntitlement()` and `requireWriteAccess()` for app write actions; access badge and notice components with slots and messages; a privacy contributor for export and deletion.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MO-1** (roadmap `monetization`, main since 2026-10-03):

> ### MO-1: Entitlements and the write guard
> - **Change ID:** `billing-entitlements`
> - **Status:** ready
> - **Outcome:** A pure entitlement state machine (`trial | paid | read_only`) with trial length and reminder windows from config; `billing.entitlements` (one row per user, separate from `auth.users`); `getEntitlement()` and `requireWriteAccess()` for app write actions; access badge and notice components with slots and messages; a privacy contributor for export and deletion.
> - **Prerequisites:** roadmap-engagement done (privacy registry released).
> - **Unknowns:** How a new user gets a trial row (auth `onRegistered` hook vs. lazy creation); an unlimited/lifetime representation; time-zone handling of trial end.
> - **Risk:** medium. A wrong guard either blocks paying users or leaks paid features.
> - **Baseline:** FIRE keeps `paid_until` / `trial_ends_at` on its users table with a hand-written guard. After: state machine unit tests for every transition and an e2e scenario where a read-only account cannot write.
> - **PRD refs:** FR-22, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/billing/` (package scaffold, entitlements, guard, badges), `modules/billing/migrations/`, `examples/next-app/e2e/billing-entitlements.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
