---
change_id: waitlist-funnel-hook
title: "Waitlist sign-ups as a funnel step"
status: backlog
roadmap_item: FU-8
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

The waitlist offers an `onJoined` hook (in the sign-up's transaction, like auth's `onRegistered`) so an app counts waitlist sign-ups in the analytics funnel with `recordFunnelStep` and the channel, without the funnel reading the waitlist's table.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-8** (roadmap `followups`, main since 2026-10-03):

> ### FU-8: Waitlist sign-ups as a funnel step
> - **Change ID:** `waitlist-funnel-hook`
> - **Status:** proposed
> - **Outcome:** The waitlist offers an `onJoined` hook (in the sign-up's transaction, like auth's `onRegistered`) so an app counts waitlist sign-ups in the analytics funnel with `recordFunnelStep` and the channel, without the funnel reading the waitlist's table.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether the hook runs for a repeat sign-up that only widens scopes; the hook's context (the transaction) and its failure policy.
> - **Risk:** LOW. Waitlist sign-ups are missing from the funnel report until then.
> - **Baseline:** monetization MO-5 `analytics-funnel`: the funnel counts server steps through hooks (`countRegistration` for auth); the waitlist has no hook, so its sign-ups cannot be counted (FIRE_TRACKER's report read `waitlist_signups` directly, which the modules do not allow across schemas). After: an e2e where a waitlist sign-up is counted under its channel.
> - **PRD refs:** FR-23.
> - **Source:** MO-5, `modules/analytics/README.md` §12 (waitlist sign-ups)

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/waitlist/` hooks.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
