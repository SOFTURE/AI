# Plan: charts-ui-primitive-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: medium (two phases, one package each,
plus docs and release).

## Goal

Every point of issue #197 lands as an optional, backward-compatible option of `@softure-ai/charts` or
`@softure-ai/ui`, with tests, README sections, charts 0.1.3 and ui 0.1.9.

**Out of scope:** a numeric x axis inside the `LineChart` composition (the issue asks for the axis primitives; the
composition stays time-based), named app surfaces in the package (see D2), the adopting app's own migration.

## Findings (the reading behind the plan)

- `svg/lines.tsx`: `GridLines`, `Baseline`, `GuideLine`, `SeriesLine` render one `<line>`/`<path>` with a fixed
  class; stroke, width and dash come from `styles.css` in `@layer softure`. A presentation attribute
  (`stroke-width="2"`) loses to a class rule, an inline `style` wins over both.
- `svg/flag.tsx` / `svg/pin.tsx`: position is required (`xPercent`), no other options besides the pin's `slot`.
  The adopting app positions its flag itself (a parent column with `left`, the chip lifted above the pin), uses
  two flag looks (accent fill; a deep fill with light text) and two sizes, and rings the pin dot in the background
  colour on a dark band so the dot cuts the line.
- `svg/axis-ticks.ts`: `timeAxisTicks` takes `Date` ticks and a time scale; `TimeTick.minor` is set only for the
  middle ticks when `ends` is given. `TimeAxis` renders one label per tick.
- The app's own axis puts the age reached in each year under the year (`subLabel`), on a month-index domain.
- ui `ThemeSwitch` passes `cookieDomain` through to `applyThemeChoice` → `buildThemeCookie`, which writes
  `Domain=<value>` unchecked. The app derives the apex from its landing origin: apex when the hostname is the apex
  or one of its subdomains; nothing for localhost, an IP or an unparseable origin.
- ui `ActionForm` maps `result.error` and every `fieldErrors` value through `getErrorMessage`. `ErrorCode` is
  `${string}.${string}` (core), so a message without a dot does not type.
- ui `ButtonLink` without `LinkComponent` already renders a plain `<a>`; neither it nor `Button` takes `className`
  (only `classNames.root`).

## Key decisions

- **D1 Primitive options, not new primitives.** Every SVG primitive (`GridLines`, `Baseline`, `GuideLine`,
  `SeriesLine`) and HTML marker (`ChartFlag`, `ChartPin`) takes `className`, `style` and `data-*` attributes
  (a `DataAttributes` type). Line primitives take `tone` (a `ChartTone` mapped to existing tokens), `slot` (a
  series colour), `strokeWidth` (screen px) and `opacity`; both go to inline `style`, so they beat the class rule.
  An app colour that is no token goes through `style` (`{ stroke: … }`), never as a raw value in the package.
- **D2 Surfaces stay tokens.** A chart on another surface (a dark band in a light page) redefines the
  `--sft-chart-*` tokens on a wrapper (or sits in a `data-theme` scope); the package names no surfaces. The pin
  takes `ring: "axis" | "surface"` because "cut the line" needs the card colour, which is a token
  (`--sft-color-surface`).
- **D3 Flag and pin looks.** `ChartFlag variant: "flag" | "ink" | "outline"` (`flag` = today; `ink` = foreground
  fill and background text, readable in both schemes; `outline` = foreground text on the surface with an axis
  border) and `size: "sm" | "md"`. `ChartPin size: "sm" | "md" | "lg"` (multiples of `--sft-chart-dot-size`) and
  `variant: "flag" | "ink"` besides `slot`. `xPercent` becomes optional on both: without it the marker is not
  positioned (the parent places it), with it markup is exactly today's.
- **D4 Numeric axis ticks.** `numberAxisTicks` beside `timeAxisTicks`, same output type (`TimeTick`, kept as the
  name of a horizontal-axis label, with `AxisTick` as an alias): ticks are numbers on a `Scale<number>`, labels from
  `format`, optional `ends` and `edgeMargin` with today's semantics. Both share one internal builder, so the edge
  rules cannot drift.
- **D5 Second label row.** `TimeTick.sublabel?: string`; both tick builders take `sublabel?: (value) => string`.
  `TimeAxis` renders it as a second line (`sft-chart-time-sublabel`) and the axis reserves two lines of height when
  any tick has one.
- **D6 Narrow-screen hiding.** `narrow?: "edges" | "alternate" | "all"` on both builders: `edges` hides every
  middle tick (today's default with `ends`), `all` hides nothing (today's default without), `alternate` keeps every
  other middle tick, starting with a hidden one when edge labels are present (it would touch the start label).
  Defaults unchanged.
- **D7 `cookieDomain` as a function.** `string | ((hostname: string) => string | null | undefined)`, called with
  `location.hostname` on each change, or `{ apex: string }`, a serializable form a server component can pass to the
  client switch (a function cannot cross that boundary). New helper `getThemeCookieDomain(hostname, apex)` (apex as a hostname or an
  origin) returns the apex or `null` (localhost, IP, unrelated host, bad origin). `buildThemeCookie` validates the
  domain (hostname characters only) and throws a `TypeError` naming it, like the other cookie validators.
- **D8 Message errors in `ActionForm`.** Props become a discriminated union: with `getErrorMessage` the action
  returns `ActionResult` (codes, today); without it the action returns `MessageActionResult`
  (`error: string`, `fieldErrors?: Record<string, string>`) and the strings are shown as they are.
- **D9 Button `className` and `ButtonAnchor`.** `className` on `Button`, `ButtonLink`, `ButtonAnchor` is appended
  to the root slot (after `classNames.root`; with `unstyled` it is the only class besides `classNames.root`).
  `ButtonAnchor` is a plain `<a>` with the button look (downloads, external addresses, full reloads), sharing
  `ButtonLink`'s markup.

## Phases

### Phase 1: charts (points 1–2), test-after

Files: `src/svg/lines.tsx`, `flag.tsx`, `pin.tsx`, `class-names.ts` (tone class, data attribute type),
`axis-ticks.ts`, `time-axis.tsx`, `src/index.ts`, `styles.css`, `tests/primitives.test.tsx`, `README.md`,
`CHANGELOG.md`, `package.json` (0.1.3).

1.1 Tones and options on the line primitives (D1, D2).
1.2 Flag and pin options (D3).
1.3 `numberAxisTicks`, `sublabel`, `narrow` (D4–D6), `TimeAxis` second row.
1.4 README sections and CHANGELOG.

Done when: tests assert exact markup for each new option and that the default markup of every primitive is
unchanged; `tests/architecture.test.ts` passes (no raw colour, every token known); the compiled stylesheet holds
every new class.

### Phase 2: ui (points 3–5), test-after

Files: `src/theme/theme-cookie.ts`, `src/theme/index.ts`, `src/ui/theme-switch.tsx`, `src/ui/action-form.tsx`,
`src/ui/button.tsx`, tests (`theme-cookie`, `action-form`, `button`), `README.md`, `CHANGELOG.md`,
`package.json` (0.1.9).

2.1 `getThemeCookieDomain`, domain validation, function `cookieDomain` (D7).
2.2 `ActionForm` message variant (D8).
2.3 `className`, `ButtonAnchor` (D9).
2.4 README and CHANGELOG.

Done when: tests cover apex / subdomain / unrelated host / localhost / IP / bad origin, an invalid domain throws,
the switch writes the domain its function returns; a message action shows its form and field messages verbatim and
a code action still maps; `className` lands on the root and `ButtonAnchor` renders an `<a>` with the look.

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` after each phase; commit per phase.

## Progress

- [ ] Phase 1: charts
- [ ] Phase 2: ui
- [ ] Impl review
- [ ] Archive
