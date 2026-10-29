---
change_id: theme-notion-touch-sizes-859
---

# Research: touch sizes (issue #859)

## What exists

- `src/tokens.ts`: `--spacing-touch-target: 44px`, so Tailwind generates `h-touch-target`, `min-h-touch-target` and
  `size-touch-target` (the README already suggests `min-h-touch-target md:min-h-row-height` for rows).
- `src/ui/button.tsx`: cva sizes `default` 28, `xs`/`sm` 24, `lg` 32, `icon` 28, `icon-xs`/`icon-sm` 24, `icon-lg` 32.
  The size is a plain class (`h-8`, `size-8`), so a caller's `md:h-7` is kept by tailwind-merge (another variant) and
  wins on a wide screen (media rules come after the base rules).
- `src/ui/select.tsx`: `SelectTrigger` sizes `default`/`sm` through `data-[size=default]:h-7 data-[size=sm]:h-6`. An
  attribute variant has a higher specificity (class + attribute) than a caller's `h-*` or `md:h-*`, which is why the
  issue's workaround uses `min-h-*`. `SelectItem` is `min-h-7` with no size.
- `SelectItem` renders inside a portal, so it cannot read the trigger's size from the DOM; a React context from
  `SelectContent` reaches every item in it.
- Tests: `tests/upstream.test.ts` guards every changed `src/ui` line against `tests/upstream/deltas.ts`;
  `tests/parity.test.tsx` compares every gallery case with `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`);
  `tests/tailwind-classes.test.ts` checks each class generates CSS. The gallery derives Button cases from the cva axes
  listed in `tests/gallery/cases.tsx`.
- Guidelines: Apple HIG 44 pt, WCAG 2.5.5 (AAA) 44 CSS px, Material 48 dp.

## Options

1. New sizes that set the height with a plain class (`h-touch-target`, `size-touch-target`, `min-h-touch-target`):
   a caller's `md:h-7` brings the pointer size back on a desktop. Chosen.
2. `data-[size=touch]:h-touch-target` on `SelectTrigger`, like the other sizes: a caller's breakpoint class loses on
   specificity, so no desktop fallback without `!`. Rejected.
3. Built-in `md:` fallbacks inside the touch sizes: decides the breakpoint for every app, and a phone in landscape or
   a tablet would get the pointer size. Rejected; the README shows the one-class fallback instead.
4. A `touch` boolean prop on `Button` raising any size: a second axis that overlaps `size`. Rejected for two sizes.
