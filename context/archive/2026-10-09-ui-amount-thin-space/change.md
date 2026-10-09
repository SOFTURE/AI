---
change_id: ui-amount-thin-space
title: "ui: parseAmount accepts the thin space (U+2009) as a group separator (issue #303)"
status: archived
roadmap_item: null
issue: 303
branch: claude/project-thread-rt0x1n
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #303](https://github.com/SOFTURE/AI/issues/303): `parseAmount(text, locale)` accepts a space, U+00A0
and U+202F between groups of three digits but not a thin space (U+2009), so `"1 234,56"` is
`ui.amount_invalid`. Thin spaces come from typeset text and from amounts an AI assistant passes as a tool argument.

U+2009 becomes one more accepted group separator in both notations, with the same strict rule: groups of exactly
three digits, never a dot or comma as a group separator in `pl`.

A reviewer checks `foundation/ui/tests/amount.test.ts` (accepted in `pl` and `en`, misplaced thin spaces refused),
the README sentence on accepted separators and the CHANGELOG entry.

## Context

Issue #303, filed by an adopting app moving its amount parsing onto `@softure-ai/ui` 0.1.12. Work is tracked in
GitHub Issues: no roadmap item; the PR closes the issue. 0.1.14 is the current version, so the change ships as the
next patch.

## Constraints

- No other separator changes: `formatAmountInput` keeps writing a plain space (the issue's note).
- English-only code and docs; no copy changes.

## Process notes

- Research: skipped as a separate file. The issue names the constant (`SPACES` in `amount.ts`); reading `amount.ts`
  and its tests answered every unknown; findings are in plan.md's "Today" section.
- Framing: skipped. The failure, its cause and the fix are stated in the issue.
