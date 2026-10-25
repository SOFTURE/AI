# Plan: theme-notion RadioGroup (issue #736)

## Phase 1: RadioGroup

Files: `themes/theme-notion/src/ui/radio-group.tsx`, `src/index.ts`, `tests/ui/radio-group.test.tsx`,
`tests/index.test.ts`, `README.md`, `CHANGELOG.md` (Unreleased).

1. shadcn new-york v4 `radio-group` with the `checkbox` deltas: 1.5 px `border-muted-foreground`, checked border in
   `primary`, dot `fill-primary`, focus `ring-2 ring-ring`, no `shadow-xs`, no `dark:bg-input/30`.
2. `export * from "./ui/radio-group.js"` in the barrel; the component count test becomes 37.
3. Tests (happy-dom): the slots; the checked item has `data-state="checked"` and the indicator dot, the others not;
   ArrowDown/ArrowUp move the choice and call `onValueChange`; the deltas in the item's class.
4. README: component count and list, the delta line next to `checkbox`; CHANGELOG entry under Unreleased.

## Decisions (auto)

- Keep shadcn's file and export names (`radio-group.tsx`, `RadioGroup`, `RadioGroupItem`) so the shadcn docs apply.
- Drop `shadow-xs` and `dark:bg-input/30` as `checkbox` does, for the same look side by side.
- No version bump: the coordinator releases in a batch.

## Progress

- [ ] Phase 1: RadioGroup
