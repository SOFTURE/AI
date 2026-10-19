---
change_id: auth-forms-pending-label-616
title: "auth: the auth forms' submit button reserves the pending label's width (issue #616)"
status: open
roadmap_item: null
issue: 616
branch: claude/project-thread-2rwrun
created: 2026-10-19
updated: 2026-10-19
---

## Intent

Close [issue #616](https://github.com/SOFTURE/AI/issues/616). `FormShell` in `modules/auth/src/ui/auth-forms.tsx`
renders the submit `Button` of every auth form (login, register, change password, forgot password, reset password)
with `pending` but without `pendingLabel`, swapping the children itself. ui's `Button` only keeps the width of the
longer label (the `data-reserve` grid) and puts the spinner in the label when it gets `pendingLabel`, so the idle
button is narrower than the same button in ui's `ActionForm` and widens on submit when it is not full width.

## Context

Labels: `bug`, `pkg: auth`. Same gap as #615 (waitlist). ui `^0.3.0` (the declared range) already ships
`pendingLabel`, so no dependency change. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Acceptance

- The idle submit button of every auth form carries its pending copy as the reserve (`data-reserve`) and shows its
  submit copy.
- While pending it shows the pending copy with the spinner in the label.
- No new props, no copy changes.

## Notes

- Framing: skipped. The issue states the problem and the fix.

## Decisions (auto)

- Take the issue's fix as written in the one shared place (`FormShell`): `pendingLabel={pendingLabel}`, children
  `submitLabel`. All five forms go through it.
