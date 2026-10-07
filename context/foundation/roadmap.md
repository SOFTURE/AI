---
project: "SOFTURE AI"
roadmap: charts-followups
version: 1
status: ready
prd_version: 2
created: 2026-10-06
updated: 2026-10-07
backlog: context/backlog/roadmap-charts-followups/
---

# Roadmap charts-followups: gaps found while delivering the charts roadmap

> Entries: [`context/backlog/roadmap-charts-followups/`](../backlog/roadmap-charts-followups/). An entry is taken
> (moved to `context/changes/<id>/`) when its item starts.
>
> Promoted on 2026-10-07 on the owner's word in the project thread, when charts closed (archived in
> [`archive/2026-10-07-roadmap.md`](archive/2026-10-07-roadmap.md)). One thread per item. Still queued in
> [`roadmaps/`](roadmaps/README.md): `later`.
>
> The catch-all of the charts roadmap (owner, 2026-10-03: gaps found while delivering a roadmap are collected, not
> fixed on the spot). It stays the catch-all while it is the main roadmap: a thread that finds a new gap takes the
> next free `CF-<n>` on the current `master`, writes `context/backlog/roadmap-charts-followups/<change-id>/change.md`
> (`status: backlog`, **Source** naming the change and the finding), and adds the row and the item block here and the row in the backlog README, with the severity
> in **Risk** and the owner's part in **Mode**.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: every item runs the full softure chain; skipping research or framing is justified in `change.md`.
> - Release: each item that changes a published package bumps it; the owner releases.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **CF-1** | `chart-pin` | `ChartPin` in `@softure-ai/charts`: an event pin (dashed vertical from the axis to a point and a dot on it) | — | autonomous | ready |
| **MK-12** | `marketing-kit-portrait-templates` | `big-number` and `carousel` portrait templates in `@softure-ai/marketing-kit` (0.1.8): the number fills a 1080×1350 post, a carousel entry renders numbered slides | — | autonomous | done |

## Order

1. **CF-1** (independent).
2. **MK-12** (independent; issue #150).

## Items

### CF-1: Event pin
- **Change ID:** `chart-pin`
- **Status:** ready
- **Source:** CH-5 (`charts-release`), mapping FIRE_TRACKER for the adoption guide: CH-2's research marked FIRE's
  `ChartPin` (`src/components/chart/chart-flag.tsx`) as generic, but CH-2 shipped only `ChartFlag`, so FIRE keeps its
  own pin when it moves to the package.
- **Outcome:** `ChartPin` (or a `GuideLine` option) in `@softure-ai/charts`: a dashed vertical from the baseline to a
  point and a dot on the point, positioned in plot percentages, on the `--sft-chart-*` tokens; tests and README.
- **Prerequisites:** none.
- **Unknowns:** whether the dot belongs in the SVG (stretched viewBox) or the HTML overlay (round at any aspect).
- **Risk:** low (a missing primitive; FIRE keeps its own until then).
- **Baseline:** FIRE `ChartPin` and its cases in `chart-primitives.test.tsx`.
- **Source (FIRE_TRACKER, read only):** `src/components/chart/chart-flag.tsx`

### MK-12: Portrait social templates
- **Change ID:** `marketing-kit-portrait-templates`
- **Status:** done
- **Input:** [`marketing-kit-portrait-templates`](../archive/2026-10-07-marketing-kit-portrait-templates/change.md)
- **Source:** GitHub issue #150 (owner, 2026-10-07), from FIRE_TRACKER TR-27: `headline-cta` at 1080×1350 leaves
  the copy in a narrow band with empty space above and below.
- **Outcome:** `big-number` and `carousel` templates written for 1080×1350, scaled by the limiting side; `size`
  presets; a carousel entry renders `<id>-1.png`…`<id>-N.png` with a counter; an optional source line; the old
  templates unchanged. marketing-kit 0.1.8.
- **Prerequisites:** none.
- **Risk:** low (new templates; the old ones are guarded by byte snapshots).

## Owner decisions and checks

- [ ] **CH-5** (carried over from charts): `@softure-ai/charts` 0.1.0 is on npm (2026-10-07, first publish with `NPM_TOKEN`): add its trusted publisher on
  npmjs.com (`@softure-ai/charts` → Settings → Trusted publisher: GitHub Actions, `SOFTURE` / `AI` / `release.yml`,
  case-sensitive, environment empty, **Allow npm publish**) and delete the `NPM_TOKEN` secret unless another new
  package is on the way. CF-1 bumps charts, so its release needs the publisher (`scripts/release/README.md`).
- [ ] **MK-12**: `@softure-ai/marketing-kit` 0.1.8 (`big-number`, `carousel`, size presets) is on `master` and waits for
  your release; after it, FIRE_TRACKER moves its two `jedna-liczba-*` entries to `big-number` and its carousels to
  `carousel` (FIRE's own change).
