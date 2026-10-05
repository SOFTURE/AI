---
change_id: testing-playwright-helpers
title: "Playwright helpers"
status: backlog
roadmap_item: DP-7
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Generic Playwright helpers (login, factories, select, wait-for, links, assertions) used by the example app's e2e.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy), item **DP-7** (main roadmap since 2026-10-05):

> ### DP-7: Playwright helpers
> - **Change ID:** `testing-playwright-helpers`
> - **Status:** ready
> - **Outcome:** `@softure-ai/testing/playwright`:
>   - login through `@softure-ai/auth`, data factories over `@softure-ai/db`;
>   - select, wait-for, links and assertion helpers;
>   - the example app's e2e moves to them where they fit; FIRE's `snapshot-form` stays in FIRE.
> - **Prerequisites:** DP-6.
> - **Unknowns:** Whether factories belong here or in each module's own testing export.
> - **Risk:** low.
> - **Baseline:** FIRE `integration/infrastructure/*` (about 70% generic). After: the helpers in the package, the example app e2e green on them.
> - **PRD refs:** FR-35, FR-9.
> - **Source (FIRE_TRACKER, read only):** `integration/infrastructure/*` (without `snapshot-form.ts`)

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `foundation/testing/src/playwright/`; example app e2e helpers.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
