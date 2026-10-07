---
change_id: ops-health-testable-handler
title: "ops: a health handler an app can unit test without Next, and the testing recipe for GET (issue #216)"
status: archived
roadmap_item: null
issue: 216
branch: claude/project-thread-vp0v4a
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close issue [#216](https://github.com/SOFTURE/AI/issues/216). An adopting app that re-exports
`GET` from `@softure-ai/ops/next` and keeps a Vitest contract test of `/api/health` sees every test
fail after moving from ops 0.1.5 to 0.1.6+:

1. `Cannot find module '…/next/server'`: `dist/next/route.js` imports `next/server` without an
   extension and plain Node ESM cannot resolve it (Next has no `exports` map).
2. Once the package is inlined: `` `connection` was called outside a request scope ``.

Neither step is in the changelog or the README. Deliver all three suggestions of the issue, each
either done or answered with a reason:

- document the recipe for testing `GET` itself (inline + `connection` stub) in the README and the
  changelog;
- keep the route's behaviour testable without mocks: the handler core, without the request-scope
  call, as a plain function on an entry that does not import Next;
- answer the `next/server.js` suggestion (not adopted: the `.js` form bypasses Next's bundler alias
  and breaks `next build`; documented in `src/next/next-modules.d.ts` and the auth README).

## Context

- `modules/ops/src/next/route.ts`: `GET` calls `connection()` first, then reads the registered config,
  runs the checks under single flight and builds the `Response`. Everything after `connection()` is
  free of Next.
- `modules/ops/src/next/database.ts` (the route's own pool) imports only `@softure-ai/db`.
- `@softure-ai/core/next` (`getSoftureConfig`) does not import `next`.
- `modules/auth/README.md` already documents `server.deps.inline: [/@softure-ai\//]`.

No roadmap: issues are the tracker.

## Constraints

- English only; neutral wording on GitHub and in the repo.
- Next imports stay extensionless.
- Backward compatible: `GET` keeps its exact behaviour and the one-line mount.
- Only `@softure-ai/ops` changes: 0.1.7 → 0.1.8, released by this thread after the merge if no other
  open change touches ops.

## Process notes

- Research: skipped as a separate artefact. The issue names the file and both errors; the reading
  needed (`route.ts`, `database.ts`, the `next/server` declaration, `core/next`, the route test, the
  auth README) fits in `plan.md` § Findings.
- Framing: skipped. The observed failure and its cause are both stated in the issue and reproduced by
  reading the code; no competing explanation.
