---
change_id: auth-page-redirect-tag
title: "A signed-in visitor's redirect from a tagged login page keeps the tag"
status: implementing
roadmap_item: FU-28
branch: claude/fu-28-auth-page-redirect-tag-jxa369
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A signed-in visitor who opens a tagged `/login` or `/register` (`/login?z=ads`) with a full page load is redirected
by the page to `afterLogin` (or the page's `next`) at a URL that keeps the page's own channel tag, as auth's action
redirects do since FU-7: the target's server render reads the channel from its `searchParams` and its beacon counts
under the channel, with or without JavaScript. Auth still does not depend on analytics. Unit tests and the example
app's e2e prove it.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-28** (roadmap `followups`, main since 2026-10-03):

> ### FU-28: A signed-in visitor's redirect from a tagged login page keeps the tag
> - **Change ID:** `auth-page-redirect-tag`
> - **Status:** proposed
> - **Outcome:** Auth's login and register pages redirect a signed-in visitor to a URL that keeps the page's own channel tag (for example `rewriteRedirect` given the page's search parameters, or a page-level counterpart of `tagRedirect` that reads them instead of `Referer`).
> - **Prerequisites:** FU-7 on `master` (shared files, see Order).
> - **Unknowns:** Whether `rewriteRedirect` can read the page's own URL in a render (it reads `Referer` today); whether the case matters enough beyond the account page's beacon.
> - **Risk:** LOW. Only a signed-in visitor opening a tagged login link with a full page load; the account view lands under no channel.
> - **Baseline:** FU-7 `analytics-action-redirect-tag`: actions keep the tag through `rewriteRedirect`; the pages' `redirect(next)` in `modules/auth/src/next/pages.tsx` does not use it, and the follow-up request's `Referer` is the page before the tagged one (analytics README §12). After: the page redirect keeps the tag, covered by e2e.
> - **PRD refs:** FR-23.
> - **Source:** FU-7 research ("Open questions"); `modules/analytics/README.md` §12

Current state: `LoginPage` and `RegisterPage` (`modules/auth/src/next/pages.tsx`) call `redirect(next)` for a
signed-in visitor before rendering. Auth's actions route their redirects through `resolveRedirectTarget`
(`modules/auth/src/redirect-target.ts`), which applies the app's `rewriteRedirect`; the example app passes analytics'
`tagRedirect`, which reads the channel from `Referer`. FU-7 is archived in
[`archive/2026-10-03-analytics-action-redirect-tag/`](../../archive/2026-10-03-analytics-action-redirect-tag/change.md).
The backlog entry this change was opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: the redirects of `modules/auth/src/next/pages.tsx` and `modules/analytics/` channel propagation
  (lane D, after FU-7). Auth must not depend on analytics (one-way module dependencies).
- Shared: `examples/next-app/` (config, e2e) is touched by other lanes; master wins, conflicts are resolved here.
- No cookie or storage for the tag (analytics README §11).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `followups`, item FU-28 (taken from `context/backlog/roadmap-followups/`).
- Research: quick depth, to answer the first Unknown (what a page render can hand `rewriteRedirect`).
- Framing: short, for the second Unknown ("whether the case matters enough").
