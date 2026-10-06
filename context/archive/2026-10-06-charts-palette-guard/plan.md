# Plan: charts-palette-guard

Input: change.md, research.md. Complexity: small (two phases: the palette check, then the palette itself).

## Goal

- `@softure-ai/charts` gets `src/palette/`:
  - `series-tokens.ts`: `SERIES_TOKENS` (`chart-series-1` … `chart-series-6`, in the documented order) and
    `SERIES_SLOTS` (its length); `class-names.ts` reads `SERIES_SLOTS` from it;
  - `check-series-palette.ts`: `checkSeriesPalette(schemes?, options?)` returns every failure in either scheme:
    contrast below 3:1 of a series token on a ground, a missing or unreadable token, and every pair closer than the
    minimum distance in normal vision or a simulation.
- `@softure-ai/charts/testing` (new subpath) exports `checkSeriesPalette`, `SERIES_GROUNDS` and the failure types.
- `@softure-ai/ui` `DEFAULT_THEME` gets the six-colour palette of research §4 (`chart-series-3` changes,
  `chart-series-4..6` are new) in `SCHEME_TOKENS`; `styles.css` of charts gets slots 4-6.
- READMEs: ui's token table and charts' palette section (order, measured margins, the helper).

**Out of scope:** FIRE's own role colours; dashed or patterned fallbacks beyond what CH-2 has; changing slot 1 or 2.

## Approach

Build the check on ui's `checkThemeContrast` (pairs `series × ground`, `use: "non-text"`) and
`findColorCollisions` (per scheme, on the readable series colours), mapping colours back to token names so a
failure says `chart-series-1 and chart-series-3`. Defaults: ui's `DEFAULT_THEME`, all series tokens, the three
grounds, `DEFAULT_MIN_COLOR_DISTANCE` and all three simulations; options narrow or change each, so an app checks
its merged theme or its own token names.

## Key decisions

- **Six colours** (research §3): 14.4 ΔE00 floor in light, 11.5 in dark (the fixed brand/ink pair).
- **Failure type:** `SeriesPaletteFailure = ContrastFailure | SeriesCollision`, where `SeriesCollision` is
  `{ kind: "collision", scheme, pair, vision, distance, minimum }`; same `scheme` and `pair` fields as ui's.
- **Grounds:** `SERIES_GROUNDS = ["color-background", "color-surface", "color-surface-raised"]`: a chart paints no
  background of its own.
- **Dependency:** `@softure-ai/ui` moves to charts' `dependencies` (`^0.1.6`), research §5.
- **Duplicate values across tokens** (an app pointing two slots at one colour) are collisions at distance 0, which
  the check reports like any other pair.

## Phase 1: The palette check (TDD)

- `tests/palette.test.ts` (charts):
  - CH-2's provisional palette, passed as `schemes`, reports exactly the three collisions of research §1
    (tokens, vision, scheme; distances to one decimal);
  - a pale series (`#d8b4fe` light) reports `low-contrast` on each ground with its ratio;
  - a missing token and a `var(...)` value are reported once per ground and left out of the distance check;
  - `tokens`, `grounds`, `minDistance` and `visions` options narrow the check; custom token names work;
  - the root entry `src/index.ts` does not re-export `testing`.
- `src/palette/series-tokens.ts`, `src/palette/check-series-palette.ts`, `src/testing/index.ts`; `package.json`
  export `./testing` and the dependency move; root lockfile; `examples/next-app/package-lock.json` refreshed (its
  `file:` entry for charts lists charts' dependencies, plan review #1).

Done when: the tests were seen red (missing modules), then green; `npm run build -w @softure-ai/charts` emits
`dist/testing/index.{js,d.ts}`; typecheck and lint green.

## Phase 2: The six-colour palette

- `tests/palette.test.ts`: `checkSeriesPalette()` on ui's `DEFAULT_THEME` returns `[]` (seen red first on CH-2's
  values, which phase 2 replaces); `SERIES_TOKENS` is the documented order and every entry is in ui's
  `SCHEME_TOKENS`; `styles.css` has one `.sft-chart-series-N` class per slot and no more; `seriesSlot` wraps at six.
- `foundation/ui/src/theme/tokens.ts` (values and the order comment), `foundation/charts/styles.css`,
  `class-names.ts`, both READMEs; `primitives.test.tsx`'s wrap assertion moves from three slots to six
  (`[0..7]` → `[1, 2, 3, 4, 5, 6, 1, 2]`, plan review #2).

Done when: the default-theme guard was seen red on CH-2's palette and is green on the new one; gates green
(typecheck, lint, test, build); the example app's e2e for `/chart` still reads slot 1 from `DEFAULT_THEME`.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The palette check

#### Automated
- [x] 1.1 Palette check tests seen red, then green — a66892c
- [x] 1.2 `./testing` export builds to `dist/testing/` — a66892c
- [x] 1.3 Typecheck and lint green — a66892c

### Phase 2: The six-colour palette

#### Automated
- [x] 2.1 Default-theme guard seen red on CH-2's palette, green on the new one — a66892c
- [x] 2.2 Slots, styles and READMEs agree on six colours — a66892c
- [x] 2.3 Gates green (typecheck, lint, test, build) — a66892c
