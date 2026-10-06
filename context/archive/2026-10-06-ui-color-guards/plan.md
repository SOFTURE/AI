# Plan: ui-color-guards

Input: change.md, research.md. Complexity: small to medium (two phases: the helpers, then the theme check and its
use on ui's own tokens).

## Goal

- `@softure-ai/ui/testing` (new subpath, source → types → built file) exports:
  - colour basics: `parseHexColor`, `blendColors`, `relativeLuminance`, `contrastRatio`, `WCAG_CONTRAST`,
    `getContrastLevel(ratio, use)`;
  - colour vision: `COLOR_VISIONS`, `simulateColorVision(hex, vision)`, `toLab`, `deltaE2000`, `colorDistance(a, b,
    { metric })`, `labHue`, `hueDistance`, `minVisionDistance`, `findColorCollisions(colors, options)`;
  - themes: `checkThemeContrast(pairs, schemes?)` and `DEFAULT_CONTRAST_PAIRS` (the pairs ui's components paint).
- `foundation/ui/tests/theme-contrast.test.ts` runs `checkThemeContrast(DEFAULT_CONTRAST_PAIRS)` on `DEFAULT_THEME`:
  green today, red when a token is darkened (sabotage case in the same file).
- README section "Testing helpers"; `@softure-ai/ui` 0.1.5 → 0.1.6.

**Out of scope:** chart palettes (CH-4), FIRE's own roles and CSS parsing, any token value change.

## Approach

Port FIRE's `color-vision.ts` into `src/testing/` split by concern (`color.ts`, `color-vision.ts`,
`theme-contrast.ts`, `index.ts`), English, with three additions from research: the tritan simulation (Machado 2009),
CIEDE2000 as the default metric (CIE76 kept as an option) and the blend for tinted grounds. Pure functions, no
runner import; a bad colour string is a bug in the caller's test and throws a `TypeError` naming the value, while
a failing pair is returned as a value.

## Key decisions

- **Metric:** CIEDE2000 by default, `metric: "cie76"` for FIRE parity (research §3). Default minimum distance 10.
- **Simulations:** Viénot for protan/deutan (FIRE parity), Machado for tritan (research §4). `findColorCollisions`
  checks `normal` plus all three by default; `visions` narrows it.
- **Pairs:** `{ foreground, background, use, level? }` where `background` is a token or `{ tint, alpha, over }`
  (the composited `bg-danger/10`), `use` is `text | large-text | non-text`, `level` defaults to `AA`.
- **Schemes argument:** `Record<"light" | "dark", Partial<Record<K, string>>>`, defaulting to `DEFAULT_THEME`, so an
  app checks its merged theme (`mergeThemes(DEFAULT_THEME, override)`) or its own token names.
- **Failures:** a discriminated union: `low-contrast` (ratio, minimum), `missing-token`, `unreadable-color` (a value
  that is not `#rgb`/`#rrggbb`, e.g. `var(...)` in an override), each with the scheme and the pair label.

## Phase 1: Colour and colour-vision helpers (TDD)

- `tests/testing-color.test.ts`: contrast oracles from the WCAG definition (black/white 21, `#777777` 4.48 and
  `#767676` 4.54 on white), level boundaries (4.5, 3, 7), `#rgb` shorthand, blend, bad input throws (a malformed colour and an alpha outside
  0–1).
- `tests/testing-color-vision.test.ts`: CIEDE2000 against Sharma, Wu and Dalal (2005) reference pairs, each value
  confirmed with `colour-science` (`delta_E`, `CIE 2000`) before it is written into the test; tritan
  against the `colorspacious` values in research §4; protan/deutan: greys unchanged, the projection idempotent,
  FIRE's measured amber/red collapse (`#b45309`/`#b91c1c` ΔE76 ≈ 6.1 in deuteranopia); `findColorCollisions` reports
  every pair and vision, honours `visions`, `metric` and `minDistance`; hue distance wraps at 360°.
- `src/testing/color.ts`, `src/testing/color-vision.ts`, `src/testing/index.ts`; `package.json` export `./testing`.

Done when: the tests were seen red (missing modules), then green; `npm run build -w @softure-ai/ui` emits
`dist/testing/index.{js,d.ts}`; typecheck and lint green.

## Phase 2: Theme contrast check on ui's tokens

- `tests/theme-contrast.test.ts`: helper cases (tinted background, missing token, `var()` value, AAA level, custom
  token names) and the guard on `DEFAULT_THEME` with `DEFAULT_CONTRAST_PAIRS`, plus the sabotage case (light `muted`
  set to `#8a8f98` fails with its ratio); the root entry `src/index.ts` does not re-export `testing` (the helpers
  stay out of the runtime bundle).
- `src/testing/theme-contrast.ts`; README "Testing helpers"; version 0.1.6 (`npm version` for the workspace, lockfile).

Done when: the guard is green on today's tokens and was seen red on a darkened token; gates green (typecheck, lint,
test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Colour and colour-vision helpers

#### Automated
- [x] 1.1 Colour and colour-vision tests seen red, then green — 10ef086
- [x] 1.2 `./testing` export builds to `dist/testing/` — 10ef086
- [x] 1.3 Typecheck and lint green — 10ef086

### Phase 2: Theme contrast check on ui's tokens

#### Automated
- [x] 2.1 `checkThemeContrast` tests green; the ui token guard seen red on a darkened token, green on the defaults — b577af1
- [x] 2.2 README section and version 0.1.6 — b577af1
- [x] 2.3 Gates green (typecheck, lint, test, build) — b577af1
