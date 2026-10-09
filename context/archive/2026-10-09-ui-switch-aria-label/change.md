---
change_id: ui-switch-aria-label
title: "ui: Switch takes an aria-label (issue #339)"
status: archived
roadmap_item: null
issue: 339
branch: claude/project-thread-u1y2wo
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #339](https://github.com/SOFTURE/AI/issues/339): `SwitchProps` omits `"aria-label"` from
`SwitchControlProps`, so a labelled `Switch` cannot get an accessible name that differs from its visible label (a
switch in a table row, whose label names the column while the name must also name the row). At runtime the prop
already reaches the input through the rest spread; only the type blocks it. After the change
`<Switch label="…" aria-label="…" />` type-checks and renders `aria-label` on the `role="switch"` input.

A reviewer checks `foundation/ui/tests/adoption-gaps-339.test.tsx`, the `SwitchProps` doc comments, the README
example and the CHANGELOG entry.

## Context

Filed against ui 0.1.14 by an adopting app; master is at 0.1.15 (on npm). Two other ui fixes target 0.1.16 in
parallel; this change shares that version (the second to merge folds into the existing section).

## Constraints

- `aria-describedby` stays omitted: `description` drives it.

## Process notes

- Research: skipped. The issue names the type, the cause and the fix; reading `switch.tsx` and `switch.test.tsx`
  answered every unknown.
- Framing: skipped. The gap is observed with its cause.

## Decisions (auto)

- Version 0.1.16, shared with the other ui changes in flight.
