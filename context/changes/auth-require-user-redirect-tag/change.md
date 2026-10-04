---
change_id: auth-require-user-redirect-tag
title: "requireUser's redirect to login keeps the channel tag"
status: plan_reviewed
roadmap_item: FU-31
branch: claude/fu-31-require-user-redirect-tag-z0d58o
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A visitor without a session who opens a tagged page that calls `requireUser()` while it renders and that the proxy's
auth guard does not protect (billing's `/payment?z=ads`, an app's own `/settings?z=ads`) is sent to the login page at a
URL that keeps the page's channel tag, as the guard's redirect does for the pages it protects. After login (or sign-up
from there) the visitor lands back on the page with the tag, so the page's render and beacon count under the channel.
Auth still does not depend on analytics. Unit tests and the example app's e2e prove it.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-31** (roadmap `followups`, main since 2026-10-03):

> ### FU-31: `requireUser`'s redirect to login keeps the channel tag
> - **Change ID:** `auth-require-user-redirect-tag`
> - **Status:** proposed
> - **Outcome:** A page that calls `requireUser()` while it renders sends a visitor without a session to the login page at a URL that keeps the page's channel tag (for example a `searchParams` option on `requireUser` handed to the app's `rewriteRedirect`, or a documented rule that such pages sit behind the proxy's auth guard).
> - **Prerequisites:** FU-28 on `master` (shared files, see Order).
> - **Unknowns:** Whether pages outside the proxy's guard are common enough to need it; how a page hands its search params to `requireUser` without changing every call.
> - **Risk:** LOW. Only pages the proxy's auth guard does not protect; the login page and the sign-up after it land under no channel.
> - **Baseline:** FU-28 `auth-page-redirect-tag`: the login and register pages' redirect of a signed-in visitor keeps the tag through `rewriteRedirect` with the page's `searchParams`; `requireUser` (`modules/auth/src/next/current-user.ts`) redirects to login with neither. After: the redirect keeps the tag, covered by e2e.
> - **PRD refs:** FR-23.
> - **Source:** FU-28 research ("Open questions"); `modules/analytics/README.md` §12

Current state: `requireUser({ next })` (`modules/auth/src/next/current-user.ts:30-36`) calls
`redirect(login[?next=…])` directly, bypassing the app's `rewriteRedirect`. FU-28 is archived in
[`archive/2026-10-04-auth-page-redirect-tag/`](../../archive/2026-10-04-auth-page-redirect-tag/change.md); the entry
this change was opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: `requireUser` in `modules/auth/src/next/current-user.ts` and `modules/analytics/` channel
  propagation (lane D, after FU-28). Auth must not depend on analytics (one-way module dependencies).
- Shared: `modules/billing/src/next/pages.tsx` (lane C) gets a one-line change at most; `examples/next-app/` (e2e) is
  touched by other lanes. Master wins; conflicts are resolved here.
- No cookie or storage for the tag (analytics README §11).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `followups`, item FU-31 (taken from `context/backlog/roadmap-followups/`).
- Research: quick depth, for the second Unknown (how a page hands its parameters to `requireUser`).
- Framing: short, for the first Unknown (whether pages outside the guard are common enough).
