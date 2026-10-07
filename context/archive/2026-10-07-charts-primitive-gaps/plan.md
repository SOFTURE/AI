# Plan: charts-primitive-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

Every point of issue #221 lands in `@softure-ai/charts` 0.1.4 as a fix or an optional option, with tests, README and
CHANGELOG.

**Out of scope:** changing what `opacity` maps to (the issue asks for docs only), the adopting app's own migration.

## Findings

- `styles.css`: `.sft-chart-flag { position: absolute; top: 0 }`, `.sft-chart-flag-free { position: static }`. Both
  classes have the same specificity and `-free` comes later, inside `@layer softure`.
- `ValueAxis` takes `ticks` and `className`; `isMinorValueTick` hides every other label counted from the top from
  four labels. Horizontal axes already have `NarrowTicks = "edges" | "alternate" | "all"`.
- `ChartPin` puts `className`/`style` on the column; the line and dot get fixed classes. `--sft-chart-dash` and
  `--sft-chart-dash-gap` are declared on `.sft-chart-guide-dashed, .sft-chart-pin-line`; the line's gradient reads
  `--sft-chart-cursor`.
- `lines.tsx` maps `opacity` to inline `strokeOpacity`.

## Key decisions

- **D1 (G1) `top: auto` on `.sft-chart-flag-free`**, not a `:not()` selector on the placed flag: the placed flag keeps
  its specificity, so an app class that moves a placed flag still wins as before.
- **D2 (G2) `ValueAxis narrow?: "alternate" | "all"`**, default `"alternate"` (today). Reuses the horizontal axes'
  vocabulary (`edges` has no meaning on a value axis, so the type is the two-value subset).
  `isMinorValueTick` keeps its signature.
- **D3 (G3) `ChartPin classNames?: { line?, dot? }`**, the slot shape the ui primitives use, added after the package
  classes. The dash variables move to `.sft-chart-pin` (the column), so they inherit to the line; a value set on the
  line itself still wins. The line reads `var(--sft-chart-pin-line, var(--sft-chart-cursor))`: a new token
  `--sft-chart-pin-line` set on the column (or anywhere above) recolours the line, undeclared it falls back to the
  cursor colour, so an app that overrides `--sft-chart-cursor` keeps working.
- **D4 (noted) README line**: `opacity` is `stroke-opacity`; for SVG `opacity` pass it in `style`.

## Phases

### Phase 1: fixes, options and docs (TDD)

1. Tests first in `tests/primitives.test.tsx`: free flag CSS has `top: auto`; `ValueAxis narrow="all"` emits no
   `sft-chart-minor` with five labels, `narrow="alternate"` equals the default; `ChartPin classNames` lands on the
   line and dot; the dash variables are declared on `.sft-chart-pin`, and the line reads `--sft-chart-pin-line`.
2. `flag.tsx` (no change), `styles.css`, `value-axis.tsx`, `pin.tsx`.
3. `tests/architecture.test.ts`: the token guard reads a name followed by `)` or `,`; `--sft-chart-pin-line` is a
   local property (plan review F1). `src/index.ts` exports `ValueAxisNarrow`, `ChartPinClassNames` (F2).
4. README (value axis row, options table, pins), CHANGELOG 0.1.4, version 0.1.4.

Done when: the new tests were red before the code and are green after; `npm run typecheck`, `npm run lint`,
`npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: fixes, options and docs

#### Automated
- [x] 1.1 New tests seen red, then green — ac6367f
- [x] 1.2 Gates green (typecheck, lint, test, build) — ac6367f
- [x] 1.3 README, CHANGELOG and version 0.1.4 — ac6367f
