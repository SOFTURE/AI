---
change_id: theme-notion-command-input-809
status: archived
---

# Plan: theme-notion CommandInput name and trailing content (issue #809)

Input: change.md, research.md. Complexity: small (one ui file, its delta list, tests, docs, the design system).

## Phase 1: the component and its tests

Files: `themes/theme-notion/src/ui/command.tsx`, `tests/upstream/deltas.ts`, `tests/behaviour/overlays.test.tsx`.

1. `CommandDialog` passes `title` to `Command` as `label`, so the combobox is named by the dialog's title.
2. `CommandInput` takes `children` (rendered after the input, inside the wrapper) and `wrapperClassName` (merged into
   the wrapper's classes with `cn`). Without them the wrapper renders its current classes unchanged.
3. Deltas for both edits, with their reasons, in `UI_DELTAS.command`.
4. Tests: the dialog's combobox is named by the title (default and prop); a bare `Command label` names it; trailing
   children render after the input inside the wrapper; `wrapperClassName` lands on the wrapper and the default
   classes stay exact without it.

## Phase 2: docs

Files: `themes/theme-notion/README.md`, `CHANGELOG.md` (`Unreleased`).

README: `Command label` in the copy list, a short palette example with `Kbd` and `wrapperClassName`. CHANGELOG: both
fixes and what the app drops (its `Command label` stays valid; the absolutely positioned `Kbd` and the parent
selector on the wrapper go).

## Phase 3: design system

Rebuild the "NOTION · Design System" artifact bundle from the changed source (the API grows, no class changes), and
let the command palette preview use the trailing `Kbd` if it shows one.

## Decisions (auto)

- `title` doubles as the label instead of a separate `label` prop: one name for the dialog and its search field, as
  the issue proposes first; an app needing different wording passes `title`.
- `children` over `end`: `Command.Input` has no children of its own, so the slot needs no new name.
- No size variant: `wrapperClassName` covers the 48 px row and any other height.
- No version bump: the coordinator releases in a batch.

## Progress

- [x] Phase 1: the component and its tests (038a656, theme-notion tests 810/810)
- [x] Phase 2: docs (5f1e20d)
- [x] Phase 3: design system (artifact version 18, no repository commit)
