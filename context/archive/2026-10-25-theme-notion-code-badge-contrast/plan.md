---
change_id: theme-notion-code-badge-contrast
status: archived
---

# Plan: theme-notion Code and destructive Badge contrast (issue #763)

Input: change.md, research.md. Complexity: small (one token, two class strings, tests, docs).

## Phase 1: the code colour, the destructive badge, tests and docs

Files: `themes/theme-notion/src/tokens.ts`, `tests/fixtures/notion-tokens.json`, `src/notion/Code.tsx`,
`src/ui/badge.tsx`, `tests/contrast.test.ts`, `tests/ui/badge.test.tsx`, a `Code` test if one exists, `README.md`,
`CHANGELOG.md`.

1. Token `code-foreground`: light `#c33c39`, dark `#f86a66`, after `secondary-foreground`; the same in the tokens
   fixture.
2. `Code`: `text-code-foreground` instead of `text-red`.
3. `Badge`: the `color` classes move to `compoundVariants` for every variant except `destructive`; the `color` variant
   keeps its keys (empty classes), so its type and default stay.
4. `tests/contrast.test.ts`: `code-foreground` on `secondary`, both schemes.
5. Badge test: a destructive badge with `color="default"` and with a palette colour has no `-tag` classes and keeps
   `text-destructive-foreground`; a tag badge keeps its colour.
6. README (`Code` paragraph, Contrast note, Badge colour note) and a CHANGELOG `Unreleased` entry with before/after
   values and what an app changes.

## Decisions (auto)

- A `code-foreground` token rather than moving `red` (research, option 1).
- `compoundVariants` rather than resetting `color` in the component, so `badgeVariants()` callers get the fix too.

## Progress

- [x] Phase 1: the code colour, the destructive badge, tests and docs (c184f13)

## Notes from implementation

- cva's `compoundVariants` takes a mutable variant array, so the list is a readonly `COLORED_VARIANTS` tuple spread
  into each entry.
- Tailwind compiles `text-code-foreground` to `color: var(--code-foreground)` next to the `text-code` font size; a
  `theme-css` test guards both.
