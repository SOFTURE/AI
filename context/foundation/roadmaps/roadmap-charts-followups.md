---
project: "SOFTURE AI"
roadmap: charts-followups
version: 1
status: waiting
prd_version: 2
created: 2026-10-06
updated: 2026-10-06
backlog: context/backlog/roadmap-charts-followups/
trigger: "the owner promotes it, or moves a single item into the main roadmap"
---

# Roadmap charts-followups: gaps found while delivering the charts roadmap

> Entries: [`context/backlog/roadmap-charts-followups/`](../../backlog/roadmap-charts-followups/). Queued roadmap
> (WORKFLOW §5.1): nothing here runs until the owner promotes it (`softure-roadmap --promote charts-followups`) or
> moves a single item into the main roadmap.
>
> The catch-all of the charts roadmap (owner, 2026-10-03: gaps found while delivering a roadmap are collected, not
> fixed on the spot). A thread that finds a new gap takes the next free `CF-<n>` on the current `master`, writes
> `context/backlog/roadmap-charts-followups/<change-id>/change.md` (`status: backlog`, **Source** naming the change
> and the finding), and adds the row and the item block here and the row in the backlog README, with the severity
> in **Risk** and the owner's part in **Mode**.
>
> Run-wide orders (read by orchestrators once promoted):
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

## Order

1. **CF-1** (independent).

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

## Owner decisions and checks

None.
