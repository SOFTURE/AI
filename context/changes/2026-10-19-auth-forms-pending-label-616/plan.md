---
change_id: auth-forms-pending-label-616
status: in_progress
---

# Plan: pending label in the auth forms (issue #616)

Input: change.md, research.md. Complexity: trivial (one prop, tests, the CHANGELOG).

## Phase 1: pass pendingLabel (TDD)

Files: `modules/auth/src/ui/auth-forms.tsx`, `modules/auth/tests/forms.test.tsx`.

1. Tests first: the idle submit button of every form (login, register, change password, forgot password, reset
   password) holds an element with `data-reserve` equal to that form's pending copy and is named by its submit copy;
   while the login action is pending the button is busy, named `en.login.pending`, and reserves `en.login.submit`.
2. Implement in `FormShell`: `pendingLabel={pendingLabel}`, children `submitLabel`.

## Phase 2: docs

`modules/auth/CHANGELOG.md` `## Unreleased`: the button keeps its width while sending; nothing to migrate.

## Progress

- [ ] Phase 1: pass pendingLabel (TDD)
- [ ] Phase 2: docs
