---
change_id: ui-suggested-amount-states
title: "SuggestedAmountField has a no-suggestion state, an explanation hint and an inline layout (issue #507)"
status: archived
roadmap_item: null
issue: 507
branch: claude/project-thread-ue4k21
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

Close [issue #507](https://github.com/SOFTURE/AI/issues/507). An app moves its "Suggested: 120 000 · use ?" money
field onto `SuggestedAmountField` without a visible change: the field can say there is no suggestion, can explain
the suggestion (or its absence) with a "?" next to the action, and can draw the suggestion as one muted inline row
(label, text button, hint) instead of a chip.

## Context

Issue #507 (labels `enhancement`, `pkg: ui`, `adoption`), proposal quoted:

> - `suggestedValue?: string | null`: with `null` the field renders without the action and shows `messages.none`
>   ("No suggestion").
> - `suggestionHint?: ReactNode` (or `explanation?: string` rendered with the package `Hint`, its label from
>   messages, e.g. "Where the suggestion comes from: {label}" / "Why there is no suggestion: {label}").
> - `suggestionVariant?: "chip" | "inline"`: `inline` renders `{messages.suggested} {amount}` followed by a text
>   button `{messages.useShort}` in one row (a `suggestionRow` slot), the hint after it.
>
> Replay after a rejected submit (`useFieldValue`) and the "focus after use" behaviour stay as they are.

## Constraints

- Owns `foundation/ui/` only (`suggested-amount-field.tsx`, `messages/en.ts`, tests, README, CHANGELOG).
- Product copy English only; every new text is a message in `suggestedAmount`, overridable per call and through the
  provider.
- Additive: today's calls (`suggestedValue` a string, chip) render the same chip with the same name and behaviour.
- No version bump: releases are batched by the coordinator; the CHANGELOG gets an `Unreleased` section.
- No change in any adopting app's repository.

## Notes

- Placement: unlinked one-off from the issue queue (`autonomy.source: issues`), `roadmap_item: null`.
- Framing: skipped. The issue names a concrete gap with a concrete contract.
- Issue #506 also touches `foundation/ui`; expect to merge master before the merge.
- Archived 2026-10-15: `SuggestedAmountField` has a no-suggestion state, a suggestion hint and an inline variant;
  ships in the next ui release.
