# Research: charts-palette-guard

Date: 2026-10-06. Sources: `foundation/ui/src/theme/tokens.ts`, `foundation/ui/src/testing/*`,
`foundation/charts/{styles.css,src/svg/class-names.ts,tests/*}`, FIRE `src/lib/position-colors.test.ts` (read only).
Measurements: scripts in the session scratchpad over `@softure-ai/ui/testing` (CIEDE2000, normal vision plus
protan, deutan and tritan, `minVisionDistance`).

## 1. Today's palette fails its own guard

CH-2's provisional series (`tokens.ts`): light `#356912`, `#16171a`, `#b45309`; dark `#cff26b`, `#f2f3f5`,
`#fbbf24`. Contrast on every ground (background, surface, surface-raised) is fine (min 4.68 light, 9.76 dark), but
`findColorCollisions` (default 10 ΔE00) reports:

| Scheme | Pair | Vision | ΔE00 |
| --- | --- | --- | --- |
| light | `#356912` / `#b45309` | protan | 4.4 |
| dark | `#cff26b` / `#fbbf24` | protan | 8.6 |
| dark | `#cff26b` / `#fbbf24` | deutan | 7.0 |

Green and amber are the classic red-green confusion pair; the third colour has to change.

## 2. What the palette has to satisfy

- **Contrast:** a series is a line, a dot and a legend swatch, so it is non-text content: 3:1 (WCAG 1.4.11) on every
  ground a chart may sit on. Charts do not paint their own background (`.sft-chart` has none), so the grounds are
  `color-background`, `color-surface` and `color-surface-raised`, as FIRE checks its presets on every ground of both
  themes (`position-colors.test.ts`, "every preset has >= 3:1 on every ground").
- **Distance:** every pair at least 10 ΔE00 (CH-3's default, derived from FIRE's CIE76 20) in normal vision and in
  all three simulations, per scheme. Normal vision is in the check on purpose: FIRE's note that a palette spread
  only on lightness passes the dichromat simulation and helps nobody.
- **Order:** slot 1 keeps the brand colour (accent) and slot 2 the ink (foreground), as CH-2 drew them and the
  example app's e2e reads slot 1. Later slots in order of distance from what is already used, so a chart with three
  series gets the widest margins.
- **Same hue family in both schemes**, so a series reads as "the purple one" whichever scheme the reader uses.

## 3. How many colours fit (the roadmap's unknown)

Greedy max-min over a 6°/5-step HSL grid filtered to 3:1 on all grounds, slots 1-2 fixed: the ninth colour lands at
8.9 ΔE00 (light) and the tenth below 10 (dark); with free colours about eight fit, but the greedy picks are
unrelated hues (a dark brown next to the ink). Restricted to named families (Tailwind's shades, one family per
slot, the best shade per scheme searched exhaustively):

| Colours (incl. brand, ink) | Best min ΔE00 over both schemes | Families |
| --- | --- | --- |
| 3 | 38.3 | fuchsia |
| 4 | 24.8 | purple, pink |
| 5 | 20.3 | purple, fuchsia, pink |
| 6 | 14.4 | teal, blue, purple, pink |
| 7 | 12.4 | orange, teal, blue, indigo/violet/purple, pink |

Answer: **six** colours with a margin of at least 4 ΔE00 over the threshold in the light scheme. The dark scheme's
floor is 11.5, and it is the fixed brand/ink pair (`#cff26b` / `#f2f3f5`), not a new colour. A seventh family costs
2 ΔE00 of margin for a series count that a line chart rarely needs; a series beyond six wraps (and is told apart by
`dashed`, as CH-2 documents).

## 4. The chosen palette

| Slot | Family | Light | Contrast (min) | Dark | Contrast (min) |
| --- | --- | --- | --- | --- | --- |
| 1 | brand | `#356912` | 6.16 | `#cff26b` | 12.85 |
| 2 | ink | `#16171a` | 16.71 | `#f2f3f5` | 14.67 |
| 3 | purple | `#a855f7` | 3.69 | `#c084fc` | 6.16 |
| 4 | pink | `#db2777` | 4.29 | `#db2777` | 3.54 |
| 5 | blue | `#1e40af` | 8.13 | `#2563eb` | 3.15 |
| 6 | teal | `#0d9488` | 3.49 | `#14b8a6` | 6.54 |

Min ΔE00 over all four visions for the first k slots: k = 3: 27.6 light / 11.5 dark; 4: 21.4 / 11.5;
5: 14.8 / 11.5; 6: 14.4 / 11.5. No collision at 10 in either scheme. Two lighter alternatives were measured and
rejected: dark blue `#3b82f6` (4.43:1) drops blue/teal to 7.4 ΔE00, light teal `#0f766e` (5.10:1) drops to 6.4.

## 5. Where the check lives

- The check is chart-specific (which tokens, which grounds, which threshold), so it belongs to charts, built on
  ui's generic helpers. It goes to a `@softure-ai/charts/testing` subpath, mirroring `@softure-ai/ui/testing`, so
  the test helpers never enter an app's runtime bundle.
- It imports `@softure-ai/ui/testing` and `DEFAULT_THEME` at run time, so `@softure-ai/ui` moves from charts'
  `devDependencies` to `dependencies` (as in every module that uses ui); charts' styles read ui's tokens anyway.
- `SERIES_SLOTS` (CH-2, `class-names.ts`) becomes the length of the token list, so the slot count, the classes in
  `styles.css` and the tokens cannot drift; a test reads the stylesheet for one class per slot.

## 6. Lessons that apply

- An unseen-green test proves nothing: the palette test is run against CH-2's palette first (it must report the
  three collisions in §1), then on the new one.
- An oracle of another kind: the distances come from ui's helpers, which CH-3 checked against published reference
  values; what is new here is the wiring (which tokens, which grounds, which scheme), so the test asserts the exact
  token pairs, visions and schemes of §1, with the distances to one decimal.
