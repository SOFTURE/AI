# Plan: theme-notion-list-entry-arrow-middle

## Approach
In `src/notion/List.tsx`, `ListEntry` computes whether the right column stacks a status over controls
(`sideLayout === "stack"`, a status and controls). Then the side keeps `items-start` (the arrow on the status's line,
#1497); otherwise the side is `items-center has-[[data-row-wide]]:items-start`, so the arrow shares the column's
middle. JSDoc, README and CHANGELOG say so.

## Phases
### Phase 1: centre the arrow on a one-line column (TDD)
- Tests first (red): in `tests/notion/List.test.tsx` a linked row with actions only has a side with `items-center`
  and `has-[[data-row-wide]]:items-start`, a row with a status over actions keeps `items-start`, an inline row is
  centred; the gallery's `ListEntry` case gets a linked row with one icon action (delete) and no status; in
  `visual/fit.spec.ts` that row's arrow middle is within 1 px of the action's middle at every viewport (24 px desktop,
  44 px phone).
- Code, the parity fixture (`UPDATE_FIXTURES=1`), the `ListEntry` gallery baselines, README, CHANGELOG `Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, the ListEntry tests of `visual/fit.spec.ts` and the gallery
  screenshots pass, typecheck, lint and build pass.

### Phase 2: Design System artifact
- Patch the `ListEntry` IIFE in the "NOTION · Design System" artifact's `bundle.js` (and `bundle.css` if a class is
  missing), publish.

## Decisions (auto)
- Option 2 of the research instead of the issue's literal proposal: it keeps #1497's arrow on the status line in the
  stacked layout and centres it everywhere the column is one line, including the issue's case.
- No new prop: the layout follows from the slots the row already has.
- Released as a minor if dependent ranges hold, else a patch.

## Progress
- [ ] Phase 1: centre the arrow on a one-line column (TDD)
- [ ] Phase 2: Design System artifact
