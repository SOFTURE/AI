---
change_id: blog-publish-cache-refresh
title: "A publish from the command line refreshes the running app's blog cache"
status: active
roadmap_item: BF-10
branch: claude/project-thread-5jsi62
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

After `softure-blog publish --commit`, the running app shows the change at once instead of after
`revalidateSeconds`, so a crawler that answers the IndexNow ping sees the new text, not the cached one.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-10).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-10**:

> - **Outcome:** an authenticated route handler from `@softure-ai/blog/next` (a secret from the environment,
>   rate-limited) calls `revalidateTag("softure-blog")`; `softure-blog publish --commit` calls it before the
>   IndexNow submit when the app gives its URL; without it the command says the app refreshes after
>   `revalidateSeconds`.
> - **Risk:** low. Today the window is `revalidateSeconds` (300 s by default), as in FIRE_TRACKER.
> - **Source:** BL-5 `blog-discovery` research Q5 (`src/cli/run.ts` runs outside Next and cannot `revalidateTag`).

The pages read through `unstable_cache` tagged `softure-blog` (`modules/blog/src/next/data.ts`); the command
(`modules/blog/src/cli/run.ts`) writes the tables and then submits the changed addresses to IndexNow
(`src/discovery/submit.ts`). The blog README §12 lists the window as a limitation.

## Constraints

- Lane B: follows BF-2 (on `master`); owns `modules/blog/src/cli/run.ts`, a new route in `src/next/`, the
  blog manifest (route, env), the blog README, the example app's mount and an e2e spec.
- Every route checks authorization; public endpoints are rate-limited (AGENTS.md, Security). Secrets come
  from the environment and are never logged.
- English-only code, comments and commits (AGENTS.md).
- No migration, no release (`@softure-ai/blog` is not published yet; its changes ride its first publish, BL-8).

## Notes

- Research kept short: two questions (what Next 16's `revalidateTag` does in a route handler, and how the
  repository rate-limits a secret-guarded route), answered from `node_modules/next` and the mcp-access endpoint.
- Framing skipped: a recorded research gap (BL-5 Q5) with a stated outcome; the premise (the CLI cannot reach
  Next's cache, only a request to the app can) is a fact of the runtime, not a choice to test.
