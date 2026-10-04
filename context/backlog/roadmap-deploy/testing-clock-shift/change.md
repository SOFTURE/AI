---
change_id: testing-clock-shift
title: "Test clock shift"
status: backlog
roadmap_item: DP-6
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/testing`: a Vitest setup that shifts the test clock to `TEST_TODAY`.

## Context

From [`roadmap-deploy.md`](../../../foundation/roadmaps/roadmap-deploy.md), item **DP-6** (queued roadmap `deploy`):

> ### DP-6: Test clock shift
> - **Change ID:** `testing-clock-shift`
> - **Status:** ready
> - **Outcome:** A new package `@softure-ai/testing` (`foundation/testing/`, copied from `templates/package/`):
>   - a Vitest setup file that shifts `Date` to `TEST_TODAY` (or a fixed default) while time keeps running, so date logic tests do not rot;
>   - documented next to the injectable clock in `@softure-ai/core`.
> - **Prerequisites:** none (roadmap trigger).
> - **Unknowns:** How it composes with `vi.useFakeTimers` in the same file.
> - **Risk:** low.
> - **Baseline:** FIRE `vitest.shift-clock.ts`. After: the setup in the package with its tests.
> - **PRD refs:** FR-35.
> - **Source (FIRE_TRACKER, read only):** `vitest.shift-clock.ts`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `foundation/testing/` scaffold, `src/vitest/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
