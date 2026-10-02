---
change_id: next-actions-spike
title: "Server actions and route handlers from a package"
status: backlog
roadmap_item: ID-1
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

a minimal package in this monorepo ships a `"use server"` action, a route handler
and a server component page. The example app consumes it once linked from the workspace and
once installed from a packed tarball, and all three work in `next dev` and in `next build && next start`.
The result decides how the config registry from `@softure-ai/core` reaches server actions and
updates docs/02 §8. If shipped actions are not viable, the fallback (route handlers + client
hooks, or app-side thin action wrappers generated per module) is chosen and documented.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **ID-1** (roadmap `identity`):

> ### ID-1: Server actions and route handlers from a package
> - **Change ID:** `next-actions-spike`
> - **Status:** ready
> - **Outcome:** a minimal package in this monorepo ships a `"use server"` action, a route handler
>   and a server component page. The example app consumes it once linked from the workspace and
>   once installed from a packed tarball, and all three work in `next dev` and in `next build && next start`.
>   The result decides how the config registry from `@softure-ai/core` reaches server actions and
>   updates docs/02 §8. If shipped actions are not viable, the fallback (route handlers + client
>   hooks, or app-side thin action wrappers generated per module) is chosen and documented.
> - **Prerequisites:** FD-3, FD-4 (foundation roadmap).
> - **Unknowns:**
>   - Does Next 16 bundle `"use server"` files from `node_modules` without `transpilePackages`?
>   - How do `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `serverActions.allowedOrigins` behave with
>     package-shipped actions across multiple instances?
>   - Can a module-level registry set in `instrumentation.ts` / `softure.config.ts` be read inside a
>     shipped action?
>   - What does `next build` output look like (tree-shaking, duplicate React)?
> - **Risk:** high. It shapes the Next adapter of every module.
> - **Baseline:** no evidence either way. After: a documented verdict, backed by a reproducible
>   spike and an e2e check in the example app.
> - **PRD refs:** FR-3, NFR-1.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: `spikes/next-actions/` (throwaway), `docs/02-module-standard.md` §8, its own e2e file in `examples/next-app/e2e/`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
