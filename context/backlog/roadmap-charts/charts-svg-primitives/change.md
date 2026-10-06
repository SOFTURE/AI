---
change_id: charts-svg-primitives
title: "SVG chart primitives"
status: backlog
roadmap_item: CH-2
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Server-rendered SVG surface, time and value axes, lines, legend and flags; a keyboard-accessible cursor; a data table fallback.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (charts), item **CH-2** (main roadmap since 2026-10-06):

> ### CH-2: SVG chart primitives
> - **Change ID:** `charts-svg-primitives`
> - **Status:** ready
> - **Outcome:** React components in `@softure-ai/charts`:
>   - server-renderable SVG: chart surface, time axis, value axis, lines, legend, flags (annotations);
>   - a client cursor that snaps to the nearest point, with keyboard support and a live region;
>   - a visually hidden data table for screen readers;
>   - colours and sizes from `--sft-chart-*` tokens added to `@softure-ai/ui`; `aria-label` text through messages;
>   - a chart page in the example app with an e2e.
> - **Prerequisites:** CH-1.
> - **Unknowns:** Whether the cursor needs pointer events only or also touch drag on mobile.
> - **Risk:** medium. Accessibility of an interactive SVG.
> - **Baseline:** FIRE `src/components/chart/*` and `chart-primitives.test.tsx`. After: the same tests green in the package; no raw colours (architecture test).
> - **PRD refs:** FR-31, NFR-3, NFR-7.
> - **Source (FIRE_TRACKER, read only):** `src/components/chart/*`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `foundation/charts/src/svg/`, `foundation/charts/src/cursor/`; chart tokens in `foundation/ui/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
