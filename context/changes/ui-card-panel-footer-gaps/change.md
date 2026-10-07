---
change_id: ui-card-panel-footer-gaps
title: "ui: Card hint look, panel heading level and footer Cancel classes (issue #218)"
status: planned
roadmap_item: null
issue: 218
branch: claude/project-thread-4d80ai
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close the three gaps that issue [#218](https://github.com/SOFTURE/AI/issues/218) lists for `@softure-ai/ui` 0.1.10,
found while an adopting app moved its `Button`, `Card` and `Modal` onto the package: the parts that slot
`classNames` cannot reach.

A reviewer checks the new tests in `foundation/ui/tests/`, the README and CHANGELOG lines and the version bump
(ui 0.1.11).

## Context

The issue, point by point (paths relative to `foundation/ui/src/ui/`):

1. `Card` renders its "?" through `CopyHint` → `Hint` with only `label`, `id`, `anchorLeft`: the hint's
   `classNames` and `triggerGap` cannot be passed, so a card's hint looks and stands differently from the app's
   standalone hints. The issue asks the same for `Field`'s label hint (same `CopyHint` path).
2. `StandingPanel` (and `Modal`) always render the title as `<h2>`; a panel that is the screen needs `<h1>`.
3. `ModalFooter` renders Cancel as `<Button variant="secondary">` with no classes from the caller.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits. Text on GitHub and in the repo stays neutral ("an adopting app").
- Backward compatible: every new prop and slot is optional; defaults keep today's markup (`h2`, gap 6 px).
- Only `@softure-ai/ui` changes. A parallel change for issue #221 (charts) may also bump ui; whichever merges
  second releases ui once (0.1.11).

## Process notes

- Research: skipped as a separate artefact. The issue names every component and prop; the reading needed
  (`card.tsx`, `copy-hint.tsx`, `field.tsx`, `form-fields.tsx`, `modal.tsx`, `action-form.tsx`, `hint.tsx`,
  `button.tsx`) is summarised in `plan.md` § Findings.
- Framing: skipped. Each point is a missing pass-through option with the observed effect and a proposed API in the
  issue; there is no competing explanation to test.
