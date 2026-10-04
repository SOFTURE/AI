---
change_id: analytics-action-redirect-tag
title: "Channel tag kept through server action redirects"
status: backlog
roadmap_item: FU-7
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A server action's redirect from a tagged page (auth's sign-up and login redirect to `afterLogin`) lands on a URL that keeps the channel tag, so the views after sign-up are counted under the visit's channel (for example the auth actions adding the tag through `withChannel`, or a `/next` helper that tags an action's redirect target).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-7** (roadmap `followups`, main since 2026-10-03):

> ### FU-7: Channel tag kept through server action redirects
> - **Change ID:** `analytics-action-redirect-tag`
> - **Status:** proposed
> - **Outcome:** A server action's redirect from a tagged page (auth's sign-up and login redirect to `afterLogin`) lands on a URL that keeps the channel tag, so the views after sign-up are counted under the visit's channel (for example the auth actions adding the tag through `withChannel`, or a `/next` helper that tags an action's redirect target).
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether a redirect helper in analytics can wrap auth's actions without auth depending on analytics; how Next renders the redirect target in the action's own response (the proxy never sees a GET for it).
> - **Risk:** LOW. The counts after sign-up land under no channel; the sign-up step itself is attributed.
> - **Baseline:** monetization MO-5 `analytics-funnel`: after the register action, the account page opens at `/account` without `?z=`, so its beacon counts without a channel (`examples/next-app/e2e/analytics-funnel.spec.ts`). After: the tag survives the redirect, covered by e2e.
> - **PRD refs:** FR-23.
> - **Source:** MO-5, `examples/next-app/e2e/analytics-funnel.spec.ts` (the account view after sign-up) and `modules/analytics/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/analytics/` channel propagation (and the redirect in `modules/auth/` if the fix needs it).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
