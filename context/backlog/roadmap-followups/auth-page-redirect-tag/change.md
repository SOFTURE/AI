---
change_id: auth-page-redirect-tag
title: "A signed-in visitor's redirect from a tagged login page keeps the tag"
status: backlog
roadmap_item: FU-23
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A signed-in visitor who opens a tagged `/login` or `/register` (`?z=ads`) with a full page load is sent to
`afterLogin` (or `next`) at a URL that keeps the channel tag, like auth's action redirects since FU-7.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-23** (roadmap `followups`):

> - **Outcome:** Auth's login and register pages redirect a signed-in visitor to a URL that keeps the page's own channel tag (for example `rewriteRedirect` given the page's search parameters, or a page-level counterpart of `tagRedirect` that reads them instead of `Referer`).
> - **Unknowns:** Whether `rewriteRedirect` can read the page's own URL in a render (it reads `Referer` today); whether the case matters enough beyond the account page's beacon.
> - **Baseline:** FU-7 `analytics-action-redirect-tag`: actions keep the tag through `rewriteRedirect`; the pages' `redirect(next)` in `modules/auth/src/next/pages.tsx` does not use it, and the follow-up request's `Referer` is the page before the tagged one (analytics README §12).

## Constraints

- Owns: `modules/auth/src/next/pages.tsx` redirects and `modules/analytics/` channel propagation (lane D, after FU-7).

## Notes
