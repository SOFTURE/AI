# Plan: theme-notion-side-layout-inline

## Approach
Add `sideLayout?: "stack" | "inline"` (type `SideLayout`, exported) to `ListEntry` and `FoldRow`, default `stack`.
The column carries `data-side-layout`. With `inline`:
- `ListEntry`: `list-entry-column` becomes `flex flex-row flex-wrap items-center justify-end gap-2`; with a
  `data-row-wide` control it keeps `flex-col items-stretch` (today's wide column). The status and actions lines keep
  their own classes, so touch targets and the menu stay as they are.
- `FoldRow`: from `md` up `fold-row-actions` stays a row (`md:flex-row md:flex-wrap md:justify-end md:gap-2`),
  `md:items-center` with `align="center"` and `md:items-start` with `align="start"`; below `md` it is unchanged.
JSDoc, README and CHANGELOG describe the rule: the state left of the controls, on one line.

## Phases
### Phase 1: inline side layout (TDD)
- Tests first (red): unit tests in `tests/notion/List.test.tsx` and `tests/notion/FoldRow.test.tsx` (classes and
  `data-side-layout` per layout, `stack` by default, `data-row-wide` keeps the column); gallery cases
  `ListEntry[sideLayout=inline]` (a watched repository: a "Readable" badge and a delete icon, plus a row with a menu)
  and `FoldRow[sideLayout=inline]`; `visual/fit.spec.ts` measures, at the desktop (1440 px) and phone (390 px)
  viewports, the badge's right edge before the first control's left edge and their middles within 2 px; for
  `ListEntry` on a phone the side under the identity, right-aligned, 44 px controls.
- Code, README, CHANGELOG `## Unreleased`, the parity fixture (`UPDATE_FIXTURES=1`), the new gallery baselines.
- Done when: `npx vitest run themes/theme-notion` passes, `visual/fit.spec.ts` and `visual/gallery.spec.ts` pass,
  typecheck, lint and build pass.

### Phase 2: Design System artifact
- Patch the `ListEntry` and `FoldRow` code in the "NOTION · Design System" artifact's `bundle.js` (and `bundle.css` for
  missing classes), note the prop in the cards, publish, render-check.

## Decisions (auto)
- A prop with `stack` as the default rather than a new default layout: no adopting row moves unasked (research,
  option 1). Same prop name and values on both components.
- `FoldRow` below `md` keeps its row under the summary, left-aligned at the chevron's inset: it is already one line,
  and the issue's acceptance for `FoldRow` is from `md` up.
- Desktop geometry is measured at the gallery's 1440 px viewport (wider than the issue's 1280 px; the column's width
  does not depend on the viewport above `md`).
- Release: a minor (a new optional prop, no dependent range broken), with #1509 if it lands in the same window.

## Progress
- [ ] Phase 1: inline side layout (TDD)
- [ ] Phase 2: Design System artifact
