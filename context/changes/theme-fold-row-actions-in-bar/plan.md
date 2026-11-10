# Plan: theme-fold-row-actions-in-bar

## Steps

1. `src/notion/FoldRow.tsx`: the wrapper becomes the hover group `group/fold-row-with-actions` (no gap, so the bar is
   continuous); the `<details>` is the `peer/fold-row`; the actions get `bg-accent` when the peer is open or the
   wrapper hovered, `rounded-r-md` and `pr-1`; the summary, only with actions, drops its right rounding and lights on
   the wrapper's hover.
2. README (`FoldRow` section), CHANGELOG, version 0.16.1 (patch: same API, a visual fix).
3. Tests: the wrapper, details and actions classes; the summary's extra classes only with actions; the plain row
   unchanged.

## Progress

- [x] 1 Bar classes in `FoldRow`.
- [x] 2 README, CHANGELOG, version 0.16.1 (package.json and package-lock.json).
- [x] 3 `npx vitest run themes/theme-notion/tests/notion/FoldRow.test.tsx` green; typecheck and lint clean. Checked in
  the adopting app's dark mode at 1440 px: the bar spans the trash icon when open and on hover.

## Decisions (auto)

- CSS siblings (`peer-open`, a group hover) rather than moving the actions into the `<summary>`: a button inside the
  summary is a control nested in the disclosure button, and keyboard and screen-reader behaviour would suffer.
- No padding reserved through a measured width: the actions keep their own box, painted like the bar.
- Patch bump: no new API.
