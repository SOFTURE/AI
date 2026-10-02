---
change_id: foundation-release
title: "Foundation release"
status: new
roadmap_item: FD-8
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/core`, `@softure-ai/db` and `@softure-ai/ui` 0.1.0 published through
FD-2 (the owner approves each first, staged publish and configures its trusted publisher), README
status lines updated, docs/02 updated with whatever the foundation changed, and a finish review
across FD-1…FD-7.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-8** (roadmap `foundation`):

> ### FD-8: Foundation release
> - **Change ID:** `foundation-release`
> - **Status:** ready
> - **Outcome:** `@softure-ai/core`, `@softure-ai/db` and `@softure-ai/ui` 0.1.0 published through
>   FD-2 (the owner approves each first, staged publish and configures its trusted publisher), README
>   status lines updated, docs/02 updated with whatever the foundation changed, and a finish review
>   across FD-1…FD-7.
> - **Prerequisites:** FD-2, FD-7.
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, G-4.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: package versions and README status lines; `docs/02-module-standard.md` updates.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
