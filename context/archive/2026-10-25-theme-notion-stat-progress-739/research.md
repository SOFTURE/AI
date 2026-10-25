# Research: StatCard progress bar (issue #739)

- `themes/theme-notion/src/notion/Stats.tsx`: `StatCards` renders each card as a flex row: a left column (label,
  figure, hint) and an optional `aside` badge on the right. The left column is `min-w-0`, so it shrinks to its content.
- `themes/theme-notion/src/ui/progress.tsx`: the shadcn `Progress` on Radix, `h-1.5` (6 px), track `bg-primary/20`,
  indicator `bg-primary` hard-coded with no way to recolour it from outside. Radix renders `role="progressbar"`,
  `aria-valuenow`, `aria-valuemin/max` on the root and passes `aria-label` through; a value outside 0..max is treated
  as indeterminate (no `aria-valuenow`), so clamping is needed for the bar and for its accessible value.
- `themes/theme-notion/src/notion/tones.ts`: `TONE_FILL` gives literal `bg-*` classes per tone (default `bg-gray`).
- Tests render with `renderToStaticMarkup` and pin class strings (`tests/notion/Stats.test.tsx`).
- `src/ui/` is the shadcn set; its component count is tested, but adding a prop to an existing component is fine.
