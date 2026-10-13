---
change_id: ui-checkbox-field-node-label-453
title: "ui: CheckboxField takes a ReactNode label (issue #453)"
status: open
roadmap_item: null
issue: 453
branch: claude/project-thread-p71lss
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #453](https://github.com/SOFTURE/AI/issues/453) (labels `enhancement`, `pkg: ui`): `CheckboxFieldProps.label`
is a `string`, so a consent statement ("I accept the [terms]") cannot link to the terms. An adopting app keeps its own
wrapper around `Checkbox` and re-implements the submit replay, the field error and `requiredMessage`. `CheckboxField`
takes a `ReactNode` label; the accessible name stays the label's text content.

## Context

ui is at 0.2.0 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. PRs #447 and #451 also touch ui and merge first; expect to merge master in.

## Constraints

- Type widening only: every existing call with a string label still compiles and renders the same markup.
- No new messages, no Polish copy.

## Notes

- Framing: skipped. The issue names the gap and two acceptable designs.

## Decisions (auto)

- Widen `label` to `ReactNode` for both modes, not a union by `labelAs`: `Switch` and `Checkbox` already take
  `ReactNode`, so a union would only forbid what both controls support, and a union on `labelAs` (which has a
  default) makes the props type harder to extend.
- `switchProps` also picks `hintLabel`: with a non-string label and a tooltip hint, `Switch` cannot derive the name
  of the "?" from the label, so the app names it. Default behaviour with a string label is unchanged.
