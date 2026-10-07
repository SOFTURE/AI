---
change_id: ui-color-guards
title: "Colour contrast and colour-vision guards"
status: backlog
roadmap_item: CH-3
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/ui/testing`: WCAG contrast, colour-vision simulation and a both-themes contrast check for token pairs.

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-07-roadmap.md) (charts), item **CH-3** (main roadmap since 2026-10-06):

> ### CH-3: Colour contrast and colour-vision guards
> - **Change ID:** `ui-color-guards`
> - **Status:** ready
> - **Outcome:** Test helpers exported from `@softure-ai/ui/testing`:
>   - WCAG 2 contrast ratio and pass levels;
>   - colour-vision simulation (protan, deutan, tritan) and a minimum distance check between colours;
>   - `checkThemeContrast(pairs)` over the light and dark token sets;
>   - `@softure-ai/ui` runs it on its own tokens, so a token change that breaks contrast fails CI.
> - **Prerequisites:** none (roadmap trigger).
> - **Unknowns:** Which colour difference metric (Delta E 2000 vs. a simpler one) gives stable thresholds.
> - **Risk:** low.
> - **Baseline:** FIRE `src/lib/color-vision.ts` and `src/app/theme-contrast.test.ts`. After: the helpers in ui with their tests; ui's token test green.
> - **PRD refs:** FR-32.
> - **Source (FIRE_TRACKER, read only):** `src/lib/color-vision.ts`, `src/app/theme-contrast.test.ts`

Reference material: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `foundation/ui/src/testing/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
