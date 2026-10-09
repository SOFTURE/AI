---
change_id: ui-controlled-fields-decimal
title: "ui: controlled TextField/MoneyField and parseDecimal with a scale (issue #320)"
status: archived
roadmap_item: null
issue: 320
branch: claude/project-thread-wukvnq
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #320](https://github.com/SOFTURE/AI/issues/320), filed by an adopting app:

1. `TextField` and `MoneyField` are uncontrolled only (`defaultValue` plus the form replay), so live calculators
   keep private copies of a controlled labelled number input. Add `value` / `onValueChange`.
2. Percent in basis points and rates in millionths use `parseAmount`'s digit grammar at another scale. Add
   `parseDecimal(text, locale, { scale })` and `formatDecimal`, and make `parseAmount` its `scale: 2` case.

A reviewer checks `foundation/ui/tests/adoption-gaps-320.test.tsx`, the unchanged `amount.test.ts` and
`form-fields.test.tsx`, the README "Forms" section and the CHANGELOG entry.

## Context

Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue. `@softure-ai/ui` 0.1.15 (#302, #303) is
on master and not released yet, so this change folds into 0.1.15. #312 may add a percent formatter to `core`; this
change adds no percent-specific formatter, only the scale-generic `formatDecimal` the issue asks for in `ui`.

## Constraints

- `parseAmount`, `formatAmountInput` and `normalizeAmountInput` keep their results and error codes exactly.
- Uncontrolled fields keep their markup and replay behaviour.
- English-only code and docs; no copy changes (decimal errors get no package message: the caller words them per
  unit).

## Process notes

- Research: skipped as a separate file. The issue names both gaps; reading `amount.ts`, `form-fields.tsx`,
  `form-context.tsx` and their tests answered every unknown; findings are in plan.md's "Today" section.
- Framing: skipped. The issue states the problem and the shape of the fix.
