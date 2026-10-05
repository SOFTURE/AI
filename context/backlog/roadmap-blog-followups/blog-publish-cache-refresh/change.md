---
change_id: blog-publish-cache-refresh
title: "A publish from the command line refreshes the running app's blog cache"
status: backlog
roadmap_item: BF-10
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

After `softure-blog publish --commit`, the running app shows the change at once instead of after
`revalidateSeconds`, so a crawler that answers the IndexNow ping sees the new text, not the cached one.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (blog-followups), item **BF-10**:

> ### BF-10: A command-line publish refreshes the app's cache
> - **Change ID:** `blog-publish-cache-refresh`
> - **Status:** ready
> - **Outcome:** an authenticated route handler from `@softure-ai/blog/next` (a secret from the environment, rate-limited) calls `revalidateTag("softure-blog")`; `softure-blog publish --commit` calls it before the IndexNow submit when the app gives its URL; without it the command says the app refreshes after `revalidateSeconds`.
> - **Risk:** low. Today the window is `revalidateSeconds` (300 s by default), as in FIRE_TRACKER.
> - **Source:** BL-5 `blog-discovery` research Q5 (`src/cli/run.ts` runs outside Next and cannot `revalidateTag`).

## Constraints

- English-only code, comments and commits (AGENTS.md).
- Every route checks authorization; public endpoints are rate-limited (AGENTS.md, Security).

## Notes
