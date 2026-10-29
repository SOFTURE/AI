---
change_id: theme-notion-mini-progress-871
---

# Research: MiniProgress (issue #871)

## What exists

- `src/ui/progress.tsx`: shadcn `Progress` with deltas: a 6 px `bg-primary/20` track, a `bg-primary` indicator moved by
  `translateX`, `dark:bg-link` as the default fill so it reaches 3:1 against its track, `indicatorClassName` for
  another fill. It is pinned to upstream by `tests/upstream.test.ts`, so a labelled bar is a composition in
  `src/notion/`, not a new delta.
- `src/notion/tones.ts`: `TONE_FILL` (`bg-gray`, `bg-green`, `bg-orange`, `bg-red`), used by `StatCard`'s bar.
  `Stats.tsx` clamps its progress with a local `clampProgress` (non-finite → 0, 0..100).
- Compositions are written `export function X` (the inventory test reads that form), with semicolons, `readonly`
  props interfaces and comments above each part. `tests/inventory.test.ts` requires each composition named in the
  README, exported from the root and drawn in `tests/gallery/cases.tsx`; `tests/parity.test.tsx` pins the gallery's
  slot classes in `tests/fixtures/notion-slots.json`; `visual/gallery.spec.ts` screenshots every case in four
  projects and runs axe; `visual/fit.spec.ts` measures geometry without baselines.
- Radix `Progress.Root` renders `role="progressbar"`, `aria-valuemin/max/now` and `aria-valuetext` from
  `getValueLabel(value, max)`; the indicator carries `data-state` and `data-value` only.

## Contrast (computed with the contrast test's own compositing)

- Label on the track (`foreground` on surface + `primary/12`): 8.2 to 10.7 in both schemes. Passes.
- The issue's label on the fill, `primary-foreground` (white in both schemes): light 4.9 on every fill (passes); dark
  2.8 on `link`, 3.2 to 3.4 on the tone fills, 2.5 on `gray`. **Fails AA in dark.**
- `background` on the fill: light 4.9 to 5.9 (white, same as `primary-foreground`), dark 5.2 to 7.1 on `link` and
  every tone fill. Passes everywhere. So the copy on the fill is `text-background`.
- The fill against the `primary/12` track (non-text, 3:1): primary/link 3.7 to 5.6 on every control surface.

## Options

1. The issue's composition as proposed, with the label on the fill in `text-background` instead of
   `text-primary-foreground`. Chosen.
2. One label with `mix-blend-mode: difference`: colours become unpredictable and contrast cannot be guaranteed.
   Rejected.
3. Extend `Progress` with a `label` prop: an upstream delta that changes its height and layout. Rejected.
