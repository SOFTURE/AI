# Plan: theme-notion smooth resize drags (#1326)

## Approach

Register the panel's width variable as non-inherited in `page.css`, and give `ResizeHandle` an opt-in live mode that
writes the variable on the controlled element during a drag and reports to React once on release.

## Phases

### Phase 1: registration and live drag (test-first)

- Tests: `tests/theme-css.test.ts` asserts the compiled sheet holds `@property --side-panel-width` with
  `inherits: false` and `syntax: "<length>"`. `tests/notion/ResizeHandle.test.tsx`: with `liveVariable` a drag writes
  `<n>px` to the variable on the `controls` element and to `aria-valuenow`, calls no `onChange` while moving, then
  `onChange` and `onCommit` once with the final width on release; an unmoved drag calls neither; the variable is
  restored before `onChange` so the parent's render owns it; keys still call `onChange` per step; a missing
  `controls` element falls back to per-move `onChange`. `tests/notion/SidePanel.test.tsx`: `SIDE_PANEL_WIDTH_VARIABLE`
  is the variable the panel sets.
- `src/page.css`: the `@property` rule, header comment.
- `src/notion/ResizeHandle.tsx`: `liveVariable` prop and the live drag.
- `src/notion/SidePanel.tsx` + `src/index.ts`: `SIDE_PANEL_WIDTH_VARIABLE`.
- README (`SidePanel`, `ResizeHandle`), gallery note if the case lists props, CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass.

### Phase 2: version

- `npm run release:version -- theme-notion minor` (0.22.0); restore the lockfile's dev flags from master, drop the
  local tag.
- Done when: package.json reads 0.22.0 and the CHANGELOG section is `## 0.22.0`.

## Progress

- [ ] Phase 1: registration and live drag
- [ ] Phase 2: version
