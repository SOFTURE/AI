---
change_id: theme-notion-mark-popover-725
status: archived
---

# Plan: MarkPopover in theme-notion (issue #725)

Input: change.md, research.md. Complexity: small (one component, its tests, docs).

## Phase 1: component and tests (TDD)

Files: `themes/theme-notion/src/notion/MarkPopover.tsx`, `themes/theme-notion/src/index.ts`,
`themes/theme-notion/tests/notion/MarkPopover.test.tsx`, `themes/theme-notion/README.md`,
`themes/theme-notion/CHANGELOG.md`.

1. Tests first (happy-dom + Testing Library): the mark button's `popovertarget` is the panel's `id` and the close
   button hides it (`popovertargetaction="hide"`); the panel is `popover="auto"`, `role="dialog"`, labelled by its
   heading; `data-slot` `mark` and `mark-popover`; `buttonData` lands on the mark button; the accessible name is
   `label`, the count and icon are hidden; the colour's tag classes are applied; only `span`/`button` elements; a
   click on panel text is prevented, a click on a link or a button inside is not; the package root exports it.
2. `MarkPopover` as in the issue's reference, client component, with `MarkPopoverProps`.
3. Export from `src/index.ts`; README (compositions list, a short usage note); CHANGELOG `Unreleased` entry with
   the migration for an adopting app.

## Decisions (auto)

- Keep the reference markup and classes verbatim (identical look required), including the `cursor-auto` and
  `backdrop:bg-transparent` details.
- Place it in `src/notion/` beside `Status` (a composition of badge + button), not in `ui/` (not a shadcn file;
  `tests/index.test.ts` counts 36 `ui/` files).

## Progress

- [x] Phase 1: 235b354
