---
change_id: ui-hint-select-toast-gaps
title: "ui: Hint, Select and ToastHost adoption gaps (issue #163)"
status: implemented
roadmap_item: null
issue: 163
branch: claude/project-thread-jy92kw
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close the seven gaps that issue [#163](https://github.com/SOFTURE/AI/issues/163) lists for `Hint`, `Select` and
`ToastHost` of `@softure-ai/ui`, found while an adopting app swapped its own toast, select, hint and feedback
components for `ui@0.1.6`, so that the app can drop the `classNames` workarounds and keep its behaviour.

A reviewer checks the new tests in `foundation/ui/tests/`, the README and the version bump (ui 0.1.8).

## Context

The issue, point by point (paths relative to `foundation/ui/src/ui/`):

1. The hint bubble inherits `text-transform` and `letter-spacing` from where the trigger stands.
2. The bubble is shown only by React state (`hidden` attribute); before hydration the "?" does nothing.
3. The gap between trigger and bubble is a fixed 6 px; an app cannot keep its own spacing.
4. Escape now also closes a bubble opened by hover or focus: worth a line in the docs.
5. `Select` measures its trigger once; inside a modal that animates in, the list lands off by the transform.
6. `ToastHost` takes no attributes for its region (e.g. `data-testid`), the only stable anchor for browser tests.
7. The package's `text-sm` (and every `text-*`) sets only the font size, so line height is inherited.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits. Text on GitHub and in the repo stays neutral ("an adopting app").
- Backward compatible: every new prop is optional, current defaults stay (gap 6 px stays the default).
- Only `@softure-ai/ui` changes; `#154` and `#158` touch core, db, auth and modules, not ui.
- Bumps `@softure-ai/ui` 0.1.7 → 0.1.8; the thread releases it after the merge (no other open change touches ui).

## Process notes

- Research: skipped as a separate artefact. The issue names every file and line; the reading needed (`hint.tsx`,
  `select.tsx`, `toast.tsx`, `scripts/build-css.mjs`, their tests) is summarised in `plan.md` § Findings.
- Framing: skipped. Each point is a concrete missing option or default with the observed effect named in the issue;
  point 4 is documentation only.
