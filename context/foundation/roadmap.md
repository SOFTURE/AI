---
project: "SOFTURE AI"
roadmap: charts
version: 1
status: ready
prd_version: 2
created: 2026-10-04
updated: 2026-10-06
backlog: context/backlog/roadmap-charts/
---

# Roadmap charts: SVG chart primitives with accessibility guards

> Reference: [`docs/06-fire-extraction-2.md`](../../docs/06-fire-extraction-2.md), PRD v2 FR-31 and FR-32.
>
> Entries: [`context/backlog/roadmap-charts/`](../backlog/roadmap-charts/). An entry is taken (moved to
> `context/changes/<id>/`) when its item starts.
>
> Promoted on 2026-10-06, when deploy-followups closed (archived in
> [`archive/2026-10-06-2-roadmap.md`](archive/2026-10-06-2-roadmap.md)). The owner decided earlier that day to run
> charts now, after deploy-followups only where an item depends on it; none does. One thread per item. Still queued
> in [`roadmaps/`](roadmaps/README.md): `later`.
>
> Written on 2026-10-04 from the second FIRE_TRACKER analysis, next to the main roadmap
> [`blog`](archive/2026-10-04-2-roadmap.md) (closed on 2026-10-04). Chart primitives were in the scope of
> `@softure-ai/ui` in the module assessment (`docs/01`) but never landed; they get their own package so `@softure-ai/ui` stays within NFR-7.
>
> Gaps found while delivering this roadmap are collected, not fixed on the spot (owner, 2026-10-03): the first gap
> creates the queued catch-all `charts-followups` (`context/foundation/roadmaps/roadmap-charts-followups.md` and
> `context/backlog/roadmap-charts-followups/`, prefix `CF-`); each gap gets the next `CF-<n>`, a backlog entry
> (`status: backlog`, **Source** naming the change and the finding) and a row, with the severity in **Risk** and
> the owner's part in **Mode**.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: every item runs the full softure chain (new → research → frame → plan → plan review → implement →
>   impl review → archive); skipping research or framing is justified in `change.md` (owner, 2026-10-03).
> - Release: each item that changes a published package bumps it (`@softure-ai/ui` for CH-3); the new
>   `@softure-ai/charts` rides its first publish (CH-5).
> - Owner at the keyboard: CH-5 only (the first npm publish of a new package).
>
> FIRE_TRACKER is read only; its domain charts (the FIRE timeline, band and position colours) stay in FIRE and are
> built on this package in FIRE's own roadmap.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **CH-1** | `charts-scale-ticks` | `@softure-ai/charts`: linear and time scales, nice ticks (dates in the app's time zone), nearest-point search | — | autonomous | **in_progress** (research, since 2026-10-06; thread claude/ch-1-scales-kjlyo6) |
| **CH-2** | `charts-svg-primitives` | server-rendered SVG surface, time and value axes, lines, legend and flags; a keyboard-accessible cursor; a data table fallback | CH-1 | autonomous | ready |
| **CH-3** | `ui-color-guards` | `@softure-ai/ui/testing`: WCAG contrast, colour-vision simulation and a both-themes contrast check for token pairs | — | autonomous | ready |
| **CH-4** | `charts-palette-guard` | series palette from tokens, distinguishable under colour-vision deficiency and legible on the surface in both themes | CH-2, CH-3 | autonomous | ready |
| **CH-5** | `charts-release` | `@softure-ai/charts` 0.1.0 and the next `@softure-ai/ui` published through the release pipeline; README complete | CH-1…CH-4 | owner | blocked (waits for CH-1…CH-4 and the owner's first npm publish at the keyboard) |

## Order

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: charts | CH-1 → CH-2 → CH-4 | `foundation/charts/`, chart tokens in `foundation/ui/` |
| B: ui guards | CH-3 | `foundation/ui/src/testing/` |

1. **First wave: CH-1 and CH-3** (independent).
2. **CH-2** after CH-1; **CH-4** after CH-2 and CH-3.
3. **CH-5** (owner) once CH-1…CH-4 are merged.

## Owner at the keyboard?

| ID | Needs the owner | Why |
| --- | --- | --- |
| CH-1…CH-4 | no | pure functions, components and tests; an example app page with an e2e |
| CH-5 | yes | first (staged) npm publish and trusted publisher on npmjs.com |

## Items

### CH-1: Chart scales, ticks and nearest point
- **Change ID:** `charts-scale-ticks`
- **Status:** in_progress (research, since 2026-10-06; thread claude/ch-1-scales-kjlyo6)
- **Outcome:** A new package `@softure-ai/charts` (`foundation/charts/`, copied from `templates/package/`) with pure functions:
  - linear and time scales;
  - nice value ticks and date ticks (days, months, years) in the app's time zone;
  - nearest-point search for a cursor;
  - a generic point type `{ x: Date | number; y: number }` instead of FIRE's `TimelinePoint`.
- **Prerequisites:** none (roadmap trigger).
- **Unknowns:** Whether date ticks need locale-aware labels from `Intl` or from the app's formatter in `@softure-ai/core`.
- **Risk:** low.
- **Baseline:** FIRE `src/lib/{chart-scale,chart-ticks,nearest-point}.ts` and their tests. After: the same tests green in the package with the generic point type.
- **PRD refs:** FR-31.
- **Source (FIRE_TRACKER, read only):** `src/lib/chart-scale.ts`, `src/lib/chart-ticks.ts`, `src/lib/nearest-point.ts`

### CH-2: SVG chart primitives
- **Change ID:** `charts-svg-primitives`
- **Status:** ready
- **Outcome:** React components in `@softure-ai/charts`:
  - server-renderable SVG: chart surface, time axis, value axis, lines, legend, flags (annotations);
  - a client cursor that snaps to the nearest point, with keyboard support and a live region;
  - a visually hidden data table for screen readers;
  - colours and sizes from `--sft-chart-*` tokens added to `@softure-ai/ui`; `aria-label` text through messages;
  - a chart page in the example app with an e2e.
- **Prerequisites:** CH-1.
- **Unknowns:** Whether the cursor needs pointer events only or also touch drag on mobile.
- **Risk:** medium. Accessibility of an interactive SVG.
- **Baseline:** FIRE `src/components/chart/*` and `chart-primitives.test.tsx`. After: the same tests green in the package; no raw colours (architecture test).
- **PRD refs:** FR-31, NFR-3, NFR-7.
- **Source (FIRE_TRACKER, read only):** `src/components/chart/*`

### CH-3: Colour contrast and colour-vision guards
- **Change ID:** `ui-color-guards`
- **Status:** ready
- **Outcome:** Test helpers exported from `@softure-ai/ui/testing`:
  - WCAG 2 contrast ratio and pass levels;
  - colour-vision simulation (protan, deutan, tritan) and a minimum distance check between colours;
  - `checkThemeContrast(pairs)` over the light and dark token sets;
  - `@softure-ai/ui` runs it on its own tokens, so a token change that breaks contrast fails CI.
- **Prerequisites:** none (roadmap trigger).
- **Unknowns:** Which colour difference metric (Delta E 2000 vs. a simpler one) gives stable thresholds.
- **Risk:** low.
- **Baseline:** FIRE `src/lib/color-vision.ts` and `src/app/theme-contrast.test.ts`. After: the helpers in ui with their tests; ui's token test green.
- **PRD refs:** FR-32.
- **Source (FIRE_TRACKER, read only):** `src/lib/color-vision.ts`, `src/app/theme-contrast.test.ts`

### CH-4: Series palette guard
- **Change ID:** `charts-palette-guard`
- **Status:** ready
- **Outcome:**
  - a series palette in chart tokens with a documented order;
  - a test that every pair stays distinguishable under the three simulations and every colour passes contrast on the chart surface in both themes;
  - an exported helper so an app checks its own palette the same way.
- **Prerequisites:** CH-2, CH-3.
- **Unknowns:** How many series colours the palette can hold before the distance check fails.
- **Risk:** low.
- **Baseline:** FIRE `src/lib/{band-colors,position-colors}.ts` tests (only the generic checks). After: the palette test green in charts.
- **PRD refs:** FR-32.
- **Source (FIRE_TRACKER, read only):** `src/lib/band-colors.ts`, `src/lib/position-colors.ts` (checks only; the colours are FIRE's)

### CH-5: Charts release
- **Change ID:** `charts-release`
- **Status:** blocked (waits for CH-1…CH-4 and the owner's first npm publish at the keyboard)
- **Outcome:** `@softure-ai/charts` 0.1.0 (the owner provides `NPM_TOKEN` for its first publish and adds its trusted publisher) and the next `@softure-ai/ui` with the testing helpers; README with an adoption guide for FIRE_TRACKER's charts.
- **Prerequisites:** CH-1…CH-4.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** package absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, FR-26, G-4.

## Owner decisions and checks

- [ ] **CH-5**: the first publish of the new `@softure-ai/charts` needs `NPM_TOKEN` for that one release; then add its
  trusted publisher on npmjs.com (SOFTURE / AI / `release.yml`), as for the other packages since 0.1.5.

## Done

(nothing yet)
