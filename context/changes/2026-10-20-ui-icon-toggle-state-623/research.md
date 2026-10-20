---
change_id: ui-icon-toggle-state-623
status: done
---

# Research: icon toggle state in @softure-ai/ui (issue #623)

## Findings

- `foundation/ui/src/ui/icons.tsx`: 35 icons on `IconFrame` (24 grid, stroke 2, `currentColor`, `aria-hidden`).
  `EyeIcon` draws the eye path and a `r=3` pupil; no crossed variant. `tests/icons.test.tsx` pins the count at 35.
- `IconProps` is `export interface` in `icons.tsx`; `src/ui/index.ts` has `export * from "./icons.js"` and
  `src/index.ts` `export * from "./ui/index.js"`, so the type is already public at the package root. The issue's
  point 3 holds no gap in the code; a test will keep it so.
- `foundation/ui/src/ui/button.tsx`: `IconButton` classes = `ICON_BASE` + `ICON_SIZE` + `ICON_TONE` + `ICON_BORDER`.
  `ICON_TONE` has only `not-disabled:hover:` colours. Nothing reacts to `aria-pressed`.
- `src/ui/segment-classes.ts`: `SEGMENT_ACTIVE_CLASS` = `bg-accent-fill text-on-accent ring-1 ring-inset
  ring-foreground`, documented as a cue that does not rely on colour. Same token pair as the primary button
  (`bg-accent-fill`, `text-on-accent`, hover `bg-accent-fill-hover`), so contrast is already covered by the theme.
- Specificity: `sft:not-disabled:hover:bg-surface-raised` compiles to `:not(:disabled):hover` (two pseudo-classes),
  which beats a lone `[aria-pressed="true"]`. The pressed hover needs its own
  `aria-pressed:not-disabled:hover:` classes to keep the fill on hover.

## Sources

`foundation/ui/src/ui/icons.tsx`, `button.tsx`, `segment-classes.ts`, `index.ts`; `tests/icons.test.tsx`,
`tests/button.test.tsx`; `README.md` (component table).
