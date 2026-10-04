---
change_id: analytics-action-redirect-tag
title: "Channel tag kept through server action redirects"
status: impl_reviewed
roadmap_item: FU-7
branch: claude/project-thread-ooknrg
created: 2026-10-03
updated: 2026-10-04
archived_at: null
---

## Intent

A visitor who signs up or logs in on a tagged page (`/register?z=ads`, `/login?z=ads`) lands on the page auth
redirects to (`afterLogin`, or `next`) at a URL that already carries the channel tag, as the server action answers it:
the target's own server render reads the channel from its `searchParams`, its beacon counts under the channel, and a
browser without JavaScript (which follows the action's `303`) gets the tagged URL too. Auth gains this without
depending on analytics. Unit tests and the example app's e2e (with and without JavaScript) prove it.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-7** (roadmap `followups`, main since 2026-10-03):

> ### FU-7: Channel tag kept through server action redirects
> - **Change ID:** `analytics-action-redirect-tag`
> - **Status:** proposed
> - **Outcome:** A server action's redirect from a tagged page (auth's sign-up and login redirect to `afterLogin`) lands on a URL that keeps the channel tag, so the views after sign-up are counted under the visit's channel (for example the auth actions adding the tag through `withChannel`, or a `/next` helper that tags an action's redirect target).
> - **Prerequisites:** FU-1, FU-5 on `master` (shared files, see Order).
> - **Unknowns:** Whether a redirect helper in analytics can wrap auth's actions without auth depending on analytics; how Next renders the redirect target in the action's own response (the proxy never sees a GET for it).
> - **Risk:** LOW. The counts after sign-up land under no channel; the sign-up step itself is attributed.
> - **Baseline:** monetization MO-5 `analytics-funnel`: after the register action, the account page opens at `/account` without `?z=`, so its beacon counts without a channel (`examples/next-app/e2e/analytics-funnel.spec.ts`). After: the tag survives the redirect, covered by e2e.
> - **PRD refs:** FR-23.
> - **Source:** MO-5, `examples/next-app/e2e/analytics-funnel.spec.ts` (the account view after sign-up) and `modules/analytics/README.md` §12

Current state: FU-5 (`<ChannelKeeper />`, archived in
[`archive/2026-10-03-analytics-client-navigation/`](../../archive/2026-10-03-analytics-client-navigation/change.md))
already puts the tag back in the browser after the action's redirect, so the funnel e2e counts the account view under
the channel. What remains (README §12): the redirect target's server render sees no tag, and a client without
JavaScript keeps the untagged URL. The auth actions redirect in `modules/auth/src/next/actions.ts` (`loginAction`,
`registerAction`, the reset and logout actions). The backlog entry this change was opened from is
[`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: `modules/analytics/` channel propagation and the redirects of `modules/auth/src/next/actions.ts`
  (lane D). Auth must not depend on analytics (the module standard's one-way dependencies).
- Shared with parallel threads: `examples/next-app/` (config, e2e) is also touched by FU-4 (waitlist); master wins,
  conflicts are resolved here.
- No cookie or storage for the tag (analytics README §11).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `followups`, item FU-7 (taken from `context/backlog/roadmap-followups/`).
- Research done (quick depth): both roadmap Unknowns need a read of Next 16's action handler and auth's options.
- Framing skipped: the gap is documented (analytics README §12) and narrowed by FU-5, the outcome and its proof are
  pinned by the roadmap item, and nothing questions whether this is the right problem; the remaining choice (a hook
  in auth vs. a wrapper in analytics) is a plan decision grounded by research.
