---
change_id: theme-flat-paint-chart-look
title: "theme-flat-paint: look maps for the chart primitives (issue #779)"
status: in_progress
roadmap_item: null
issue: 779
branch: claude/project-thread-ivipvl
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #779](https://github.com/SOFTURE/AI/issues/779): an adopting app on `@softure-ai/theme-flat-paint`
stops keeping the Flat Paint look of `ChartFlag`, `ChartPin` and the chart tones in its own code. The theme gains
`look/chart.ts` with `CHART_FLAG_VARIANT_LOOK`, `CHART_FLAG_SIZE_LOOK`, `CHART_PIN_LOOK` and `CHART_ROLE_TONE`.

## Context

- Labels: `enhancement`, `adoption`, `pkg: theme-flat-paint`.
- The theme already ships look maps for the ui components (`look/*.ts`, a Tailwind source through `theme.css`).
- Parallel changes in the same package (#780, #781, #782, #784) touch the barrel, the README and `page.css`.

## Constraints

- No dependency on `@softure-ai/charts`: the look maps name its prop values as local types, as they do for ui.
- No version bump: the coordinator releases.

## Notes

- Framing: skipped. The issue names the outcome and the exports.
