---
change_id: ui-charts-adoption-gaps
title: "ui + charts: adoption gaps (issue #157)"
status: archived
roadmap_item: null
issue: 157
branch: claude/project-thread-n3c0qh
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close the thirteen gaps that issue [#157](https://github.com/SOFTURE/AI/issues/157) lists for `@softure-ai/ui` and
`@softure-ai/charts`, found while an adopting app planned its switch to `ui@0.1.6` and `charts@0.1.0`, so that the
app can swap its own theme cookie, forms, buttons, modals, cards, icons and charts for the packages without losing
saved choices, behaviour or looks.

A reviewer checks the new tests in `foundation/ui/tests/` and `foundation/charts/tests/`, the README sections of both
packages and the version bumps (ui 0.1.7, charts 0.1.2).

## Context

The issue, point by point (paths relative to `foundation/ui/src/`):

1. Theme cookie values are fixed to `light` / `dark`; an app storing other values would reset every saved choice.
2. `ActionResult` success requires `value`; app actions return `{ ok: true }`.
3. No app-wide locale: every component defaults to `en` and takes `locale` one by one.
4. Scheme selectors are fixed to `[data-theme]`; an app re-scopes tokens in page sections.
5. Button: no neutral solid (`ink` / `ink-outline`) variant, no `pendingLabel` that keeps the width.
6. Modal: no side panel width or standing (always mounted) panel; the overlay colour is not a token.
7. Card: no collapsible, step / done badge, accent edge or heading level.
8. ActionForm's default `submitVariant` is `primary`; an app that defaulted to `secondary` would change looks
   silently: document it.
9. `ThemeScript` ignores `design`, which the provider accepts, so bar colours fall back to defaults.
10. Icons: `ChildIcon`, `LoanIcon` missing; the segment class constants are not exported.
11. `NUMBER_INPUT_CLASS` lacks `slashed-zero`.
12. `"sideEffects": false` while shipping CSS; a JS import of the stylesheet can be tree-shaken.
13. charts: `@softure-ai/ui` is a dependency (two copies possible); the y domain cannot go below zero. `ChartPin`
    shipped already (charts 0.1.1).

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits. Text on GitHub and in the repo stays neutral ("an adopting app").
- Backward compatible: every new prop is optional, current defaults stay (the issue asks to document, not change,
  point 8).
- `@softure-ai/core` stays untouched: `#158` changes it later, and a core change would force a core release first.
- Bumps `@softure-ai/ui` 0.1.6 → 0.1.7 and `@softure-ai/charts` 0.1.1 → 0.1.2; the thread releases both after the
  merge (it holds the last change in both packages).

## Process notes

- Research: skipped as a separate artefact. The issue already names every file and line; the reading needed (the
  current sources of both packages and the adopting app's button, card, disclosure, modal and standing panel, read
  in full) is summarised in `plan.md` § Findings, so a `research.md` would repeat it.
- Framing: skipped. Each point is a concrete missing option with the app's usage counted in the issue; there is no
  competing explanation, and point 8 is already framed by the issue as documentation, not a change.
