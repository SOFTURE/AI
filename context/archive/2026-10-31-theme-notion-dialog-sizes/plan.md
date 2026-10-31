---
change_id: theme-notion-dialog-sizes
status: archived
---

# Plan: dialog sizes `lg` and `sm`

Input: change.md, research.md. Complexity: small.

## Phase 1: component (TDD)

Files: `themes/theme-notion/src/ui/dialog.tsx`, `tests/ui/dialog.test.tsx`, `tests/upstream/deltas.ts`.

- `size?: "sm" | "default" | "wide" | "lg"`.
- `lg`: `flex flex-col overflow-y-auto h-[calc(100dvh-2rem)] sm:h-3/4 sm:max-w-3/4 lg:h-1/2 lg:min-h-96
  lg:max-w-1/2` (a quarter free on every side from `lg`; `min-h-96` keeps a short laptop window usable).
- `sm`: `max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md`.
- Tests first: the classes of each size, `default` and `wide` unchanged.

## Phase 2: docs

README `dialog` note, CHANGELOG `## Unreleased`.

## Phase 3: release

Version bump `0.10.3` in its own pull request, then Actions → `auto-release` with `theme-notion`.

## Decisions (auto)

- `lg` is a fixed height, not a cap: the owner asked for a quarter free on every side, and a form that grows and
  shrinks while it is edited would move its footer.
- `lg` scrolls its whole content by default; an app with a fixed header and footer sets `p-0 gap-0` and scrolls its
  own body (`min-h-0 flex-1 overflow-y-auto`).
- `sm` is `max-w-md` (28 rem): narrower than the default's 32 rem without squeezing a list of short notes.
- A patch bump: new options, defaults unchanged.

## Progress

- [x] Phase 1: component
- [x] Phase 2: docs
- [x] Phase 3: release (version 0.10.3 bumped in this pull request; auto-release after the merge)
- [x] Implementation review: approved
