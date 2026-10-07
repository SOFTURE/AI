---
change_id: charts-ui-primitive-gaps
title: "charts + ui: primitive tones, numeric axes, theme cookie domain, message errors (issue #197)"
status: archived
roadmap_item: null
issue: 197
branch: claude/project-thread-2blwnt
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close the five gaps that issue [#197](https://github.com/SOFTURE/AI/issues/197) lists for `@softure-ai/charts` and
`@softure-ai/ui`, left after ui 0.1.8 and charts 0.1.2, so that an adopting app can drop its own SVG primitives,
axes, theme switch wrapper, form error adapter and anchor button.

A reviewer checks the new tests in `foundation/charts/tests/` and `foundation/ui/tests/`, the README sections of
both packages and the version bumps (charts 0.1.3, ui 0.1.9).

## Context

The issue, point by point:

1. charts primitives are styled by one class each: `GuideLine` takes no tone, colour, stroke width or `data-*`;
   `GridLines` no opacity or surface; `ChartFlag` / `ChartPin` only `slot` (no variant, size, className, style).
2. charts axes: no numeric domain (a month index instead of a `Date`), no second label row (an age under the year),
   no control over which ticks hide on narrow screens.
3. ui `ThemeSwitch` `cookieDomain` is a fixed string; the app computes the apex from the hostname on click.
4. ui `ActionForm` requires `ErrorCode` + `getErrorMessage`; an app whose actions return ready messages needs an
   identity mapper and a cast.
5. ui `Button` has no `className`; there is no plain-anchor button (`ButtonAnchor`) besides `ButtonLink`.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits. Text on GitHub and in the repo stays neutral ("an adopting app").
- Backward compatible: every new prop is optional; current markup and defaults stay.
- charts keeps the token-only rule (`tests/architecture.test.ts`): no raw colour or size in the package; an app's
  own colour or width arrives through `style` / `className` / numeric props.
- Bumps `@softure-ai/charts` 0.1.2 → 0.1.3 and `@softure-ai/ui` 0.1.8 → 0.1.9; the thread releases both after the
  merge unless another open change still touches them.

## Process notes

- Research: skipped as a separate artefact. The issue names every component; the reading needed (the current
  sources of both packages and the adopting app's own primitives, axis and theme cookie helper) is summarised in
  `plan.md` § Findings.
- Framing: skipped. Each point is a concrete missing option on an existing component; there is no competing
  explanation of the problem.
