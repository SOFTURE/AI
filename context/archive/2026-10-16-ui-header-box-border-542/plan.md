---
change_id: ui-header-box-border-542
status: archived
---

# Plan: AppHeaderBar inner row with box-border (issue #542)

Input: change.md, research.md. Complexity: trivial (one class, one test, docs).

## Phase 1: fix (TDD)

Files: `foundation/ui/src/ui/app-header-bar.tsx`, `foundation/ui/tests/app-header-bar-box-border-542.test.tsx`.

1. Test first: the `inner` element carries `sft:box-border` next to `sft:w-full` and `sft:px-4`; `unstyled` drops it
   and `classNames.inner` is appended.
2. Add `sft:box-border` to the `inner` default.

## Phase 2: docs

`foundation/ui/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: fix (2 tests written first, both red before the change; #407 AppHeaderBar tests pass unchanged)
- [x] Phase 2: docs (CHANGELOG `## Unreleased`)

Gates on the branch: `npm run typecheck` and `npm run lint` in pre-commit; the full `npm test` runs in pre-push.
