---
change_id: theme-flat-paint-radio-794
status: planned
---

# Plan: radio and choice look maps (issue #794)

Input: change.md, research.md. Complexity: small (one new look file, tests, docs).

## Phase 1: look maps

Files: `themes/theme-flat-paint/src/look/choice.ts` (new), `src/index.ts`, `tests/choice.test.tsx` (new),
`tests/theme-css.test.ts`, `README.md`, `CHANGELOG.md`.

1. `RadioSlot = "box" | "input" | "mark"`, `RADIO_LOOK`: a 20 px box; the native input is the drawn circle
   (`line-strong` border on `surface-raised`, checked `border-accent bg-accent-fill`); the mark (wrapping a 12 px
   check icon) is `on-accent` and scales in on `peer-checked`.
2. `ChoiceSlot = "label" | "control" | "body" | "title" | "description"`, `CHOICE_ROW_LOOK` (hover and checked
   background, `has-checked:shadow-selected-row`, focus outline inset) and `CHOICE_CARD_LOOK` (bordered tile, checked
   `border-foreground` plus inset ring, focus outline outside). Titles `group-has-checked:font-bold`.
3. Tests: exact values; a server render of the documented markup puts the classes on the right elements; compiled CSS
   carries `checked:bg-accent-fill`, `peer-checked:scale-100`, `has-checked:shadow-selected-row`,
   `group-has-checked:font-bold`, `has-focus-visible:outline-accent`.
4. Barrel, README table and markup example, CHANGELOG `Unreleased`.

## Decisions (auto)

- One checked drawing, the lime disc with an `on-accent` check (the issue's proposal); the row's accent ring is gone.
- The idle circle is `surface-raised`, as `CHECKBOX_LOOK`'s frame, not the issue's `background`: one control family.
- Focus is an `accent` outline on the label (inset on the row, offset on the card) instead of a ring (R5).
- `has-checked:` / `has-focus-visible:` / `group-has-checked:` instead of `has-[:checked]:` forms: same selectors,
  the form ui and `SEGMENTED_CONTROL_LOOK` use.
- The row's bar is the `shadow-selected-row` token instead of an arbitrary shadow: same value, merges in `cn`.
- Title and description sizes follow `CHECKBOX_LOOK` (label default, description `text-xs text-muted`).

## Progress

- [ ] Phase 1: look maps
