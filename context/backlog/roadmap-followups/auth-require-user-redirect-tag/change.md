---
change_id: auth-require-user-redirect-tag
title: "requireUser's redirect to login keeps the channel tag"
status: backlog
roadmap_item: FU-31
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A visitor without a session who opens a tagged page that calls `requireUser()` while it renders (`/settings?z=ads`,
not behind the proxy's auth guard) is sent to the login page at a URL that keeps the channel tag, as the proxy's guard
does for the pages it protects.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-31** (roadmap `followups`):

> - **Outcome:** A page that calls `requireUser()` while it renders sends a visitor without a session to the login page at a URL that keeps the page's channel tag (for example a `searchParams` option on `requireUser` handed to the app's `rewriteRedirect`, or a documented rule that such pages sit behind the proxy's auth guard).
> - **Unknowns:** Whether pages outside the proxy's guard are common enough to need it; how a page hands its search params to `requireUser` without changing every call.
> - **Baseline:** FU-28 `auth-page-redirect-tag`: the login and register pages' redirect of a signed-in visitor keeps the tag through `rewriteRedirect` with the page's `searchParams`; `requireUser` (`modules/auth/src/next/current-user.ts`) redirects to login with neither.

## Constraints

- Owns: `requireUser` in `modules/auth/src/next/current-user.ts` and `modules/analytics/` channel propagation (lane D,
  after FU-28).

## Notes
