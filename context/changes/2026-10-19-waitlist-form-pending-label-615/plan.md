---
change_id: waitlist-form-pending-label-615
status: in_progress
---

# Plan: pending label in WaitlistForm (issue #615)

Input: change.md, research.md. Complexity: trivial (one prop, a test, the CHANGELOG).

## Phase 1: pass pendingLabel (TDD)

Files: `modules/waitlist/src/ui/waitlist-form.tsx`, `modules/waitlist/tests/waitlist-form.test.tsx`.

1. Tests first: the idle button holds an element with `data-reserve` equal to `en.form.pending` and its name is
   `en.form.submit`; while the action is pending the button is busy, named `en.form.pending`, and reserves
   `en.form.submit`.
2. Implement: `pendingLabel={messages.form.pending}`, children `messages.form.submit`.

## Phase 2: docs

`modules/waitlist/CHANGELOG.md` `## Unreleased`: the button keeps its width while sending; nothing to migrate.

## Progress

- [ ] Phase 1: pass pendingLabel (TDD)
- [ ] Phase 2: docs
