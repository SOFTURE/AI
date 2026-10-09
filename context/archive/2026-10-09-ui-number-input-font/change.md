---
change_id: ui-number-input-font
title: "ui: number inputs render monospace (issue #302)"
status: archived
roadmap_item: null
issue: 302
branch: claude/project-thread-m1y869
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #302](https://github.com/SOFTURE/AI/issues/302): `NUMBER_INPUT_CLASS` is `INPUT_CLASS` plus
`sft:font-mono`, and `INPUT_CLASS` already carries `sft:font-sans`. Both set `font-family` at the same specificity and
the sans rule comes later in `dist/styles.css`, so every number input (`TextField` with `inputMode`, `MoneyField`)
draws in sans. After the change each input look carries exactly one font family utility, and number inputs draw in
`--sft-font-mono` with the placeholder in sans.

A reviewer checks `tests/adoption-gaps-302.test.tsx`, the README paragraph on number inputs and the CHANGELOG entry.

## Context

Filed against ui 0.1.12 by an adopting app; master is at 0.1.14 (on npm) and still has it. Work is tracked in GitHub
Issues, one issue per change: no roadmap item. Ships as 0.1.15.

## Constraints

- `INPUT_CLASS` and `NUMBER_INPUT_CLASS` stay exported with the same purpose; only the family utilities change.
- Text inputs and the `Select` trigger keep the sans face.

## Process notes

- Research: skipped as a separate file. The issue names the constant, the cause and the fix; reading `field.tsx`,
  `form-fields.tsx`, `select.tsx` and their tests answered every unknown (plan.md, Today).
- Framing: skipped. The failure is observed with its cause.
