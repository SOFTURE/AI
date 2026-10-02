# Plan: ui-tokens-theme

Input: change.md, research.md. Complexity: medium.

## Goal

`@softure-ai/ui` is a workspace package that ships:

- the `--sft-*` token contract with complete light and dark defaults;
- `SoftureThemeProvider`, which applies a theme given as an object or imported from a `design.json`;
- `ThemeScript` (the no-flash boot script for `<head>`) and `ThemeSwitch` (light, dark, system),
  with `en` and `pl` labels;
- `dist/styles.css`, compiled by Tailwind 4 from the package's components, with tokens and
  utilities inside `@layer softure`, measured against NFR-7 (≤ 20 kB gzip) on every build;
- `dist/tailwind.css`, the `@theme inline` bridge that maps the app's Tailwind 4 onto the tokens.

**Out of scope:** UI primitives (Button, Modal, SegmentedControl…; FD-6), a DOM test environment
and an architecture test for inline copy (FD-6), the example app and e2e (FD-7), publishing (FD-8).

## Approach

**Starting point:** `foundation/ui/` is an empty scaffold (research §Current state). FIRE_TRACKER's
theme (`src/lib/theme.ts`, `src/app/globals.css:54-190`, `src/components/theme-switch.tsx`) is the
behaviour to port; docs/02 §5 is the contract.

**Chosen:** the token contract lives in TypeScript (`src/theme/tokens.ts`) and every CSS artefact is
generated from it: the provider's `<style>`, the default tokens inside `styles.css`, the package's
internal Tailwind theme and the app bridge. `npm run build` runs `tsc` first (L-001), then
`scripts/build-css.mjs` imports the built generator from `dist/` and runs the Tailwind CLI.
Rejected: tokens hand-written in CSS with a drift test against TS (two sources of truth, the drift
test only narrows the gap); runtime CSS-in-JS (forbidden by NFR-7); Tailwind `@apply` component
classes such as `.sft-switch` (every FD-6 port would need rewriting instead of prefixing classes).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Class syntax | Tailwind prefix `sft:` (`sft:bg-surface`) | the only prefix Tailwind 4 supports; FIRE classes port by prefixing | research |
| Internal theme | `@theme inline reference prefix(sft)` | no emitted variables, utilities read `var(--sft-*)` directly | research |
| Layer order | `styles.css` opens with `@layer theme, base, softure, components, utilities;` | softure above preflight, below the app's components and utilities | research |
| Token set | docs/02 §5 plus `color-border-strong`, `color-accent-fill-hover` | FIRE controls need both | research |
| Theme input | `{ light?, dark?, shared? }`; colours and shadows per scheme, the rest shared | non-colour tokens should not need repeating per scheme | research |
| Override CSS shape | per scheme under `[data-theme=…]` and `@media (prefers-color-scheme: …) :root:not([data-theme=…])`; shared on `:root` | an unlayered bare `:root` override would leak into dark mode | research |
| Value safety | values containing `;`, `{`, `}`, `<`, `>` or a newline are rejected | values land in a `<style>` element | research |
| design.json | `themeFromDesignJson(unknown): Result<{ theme, ignoredRoles }, DesignJsonError>` | expected failure on bad input; unknown roles are reported, not fatal | research, AGENTS.md |
| Cookie | `sft-theme` = `light`/`dark`, absent = system, name and domain configurable | FIRE mechanism without its Polish values and apex logic | research |
| Locale and copy | `ThemeSwitch` takes `locale` (default `en`) and partial `messages` | matches core's per-call overrides; no UI-wide provider yet | research |
| Size budget | `build-css.mjs` fails above 20 kB gzip and prints the size | NFR-7 measured on every build | roadmap |

**Critical details:**
- `styles.css` must be imported before `@import "tailwindcss"` (in the app's CSS) so the layer order
  statement is the first one the browser sees; importing it later from JS puts `softure` above the
  app's utilities. The README says so.
- The boot script runs as text before the bundle; it may not reference anything outside its own
  string, and it must not throw when cookies are blocked.

## Phase 1: Token contract and theme logic

**Discipline:** TDD. **Files:** `foundation/ui/{package.json,tsconfig.json,tsconfig.build.json,README.md}`,
`foundation/ui/src/index.ts`, `foundation/ui/src/theme/{tokens.ts,theme-css.ts,design-json.ts,theme-cookie.ts,index.ts}`,
`foundation/ui/tests/{tokens,theme-css,design-json,theme-cookie}.test.ts`, root `package.json`, `package-lock.json`.

1. `foundation/ui/package.json` etc.: workspace from `templates/package/` without `module.json`,
   migrations or server/next entries (ui is a foundation package like core). Exports `"."` only;
   the CSS exports arrive with their build in phase 3. Dependencies `@softure-ai/core`, `zod`; peer `react ^19`.
   Root devDependencies: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `tailwindcss`,
   `@tailwindcss/cli`.
2. `src/theme/tokens.ts`: `SCHEME_TOKENS` (colours, shadows) and `SHARED_TOKENS` (fonts, text sizes,
   radius, space 1-8, durations, eases) as readonly name lists; `DEFAULT_THEME` with FIRE's values;
   types `SchemeTokenName`, `SharedTokenName`, `SoftureTheme = { light?, dark?, shared? }`;
   `tokenVar(name)` → `--sft-<name>`.
3. `src/theme/theme-css.ts`: `buildThemeCss(theme, { complete? })` → CSS text in the four-block shape
   plus `:root` for shared tokens and `color-scheme` per block; empty theme → empty string; throws
   `TypeError` naming the token on an unsafe value or an unknown token name.
   `buildTailwindTheme({ prefix })` → the `@theme inline` block (`reference prefix(sft)` for the
   package build, plain for the app bridge). `getThemeColors(theme)` → `{ light, dark }` background
   colours for `meta theme-color`.
4. `src/theme/design-json.ts`: zod schema for `schemaVersion` and `themes.{light,dark}.roles`;
   role mapping table from research; returns `Result`.
5. `src/theme/theme-cookie.ts`: `ThemeChoice`, `DEFAULT_THEME_COOKIE`, `parseThemeCookie`,
   `buildThemeCookie(choice, { cookieName, domain })`, `getThemeBootScript({ cookieName, themeColors })`,
   `applyThemeChoice(choice, { doc, cookieName, domain, themeColors })`.

**Tests:** every scheme token has a light and a dark default and every shared token a default;
token names are unique kebab-case; `buildThemeCss` puts light values under `[data-theme="light"]` and
the light media block, never on bare `:root`; shared tokens on `:root`; empty input gives `""`;
unsafe value (`red;}`, `</style>`) and unknown name throw with the token named; Tailwind theme maps
every colour, font, text, radius, space and shadow token and no duration; design.json: FIRE sample
maps 11 roles per scheme and reports `accessible`, `locked`, `debt` as ignored; non-object, wrong
`schemaVersion`, non-string role value → `err`; cookie: absent/foreign/garbage → system,
round-trip, system deletes, domain appended; boot script (run through `new Function` on a fake
document): sets `data-theme`, no attribute without cookie, survives a throwing `cookie` getter,
honours a custom cookie name.

**Done when:**
- Automated: the phase 1 tests fail before the sources exist and pass after.
- Automated: `npm run build` emits `foundation/ui/dist/index.js` and `index.d.ts`.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: Provider, boot script component and theme switch

**Discipline:** test-after. **Files:** `foundation/ui/src/ui/{class-names.ts,softure-theme-provider.tsx,theme-script.tsx,theme-switch.tsx,index.ts}`,
`foundation/ui/src/messages/{en.ts,pl.ts,index.ts}`, `foundation/ui/tests/components.test.tsx`, `foundation/ui/tests/architecture.test.ts`.

1. `src/messages/*`: `themeSwitch.{legend,light,dark,system}` in `en` and `pl`; `uiMessages`.
2. `src/ui/softure-theme-provider.tsx`: server-safe component; renders
   `<style data-softure-theme>` with `buildThemeCss(theme)` (nothing when the theme is empty), then children.
   Props: `theme?: SoftureTheme` and `design?: unknown` (a `design.json` value). `design` is parsed
   with `themeFromDesignJson` and applied first, `theme` overrides it per token; an invalid `design`
   throws an `Error` naming the failing field (a configuration bug, caught at the first render).
3. `src/ui/theme-script.tsx`: renders `<script>` with `getThemeBootScript`, optional `nonce`.
4. `src/ui/theme-switch.tsx` (`"use client"`): radio group (fieldset, legend, three radios),
   `useSyncExternalStore` on the cookie (server snapshot `system`), `classNames` slots
   `root, legend, options, option, input, label`, `unstyled`, `onChange`. Default styling uses `sft:`
   classes on tokens only.
5. `tests/architecture.test.ts`: no raw colour literal (`#hex`, `rgb(`, `hsl(`, `oklch(`) in `src/ui/`.

**Tests:** provider renders the override CSS and its children, renders no `<style>` for an empty
theme, throws on an unsafe value, applies a `design` value and lets `theme` override it, throws
on an invalid `design`; script renders the boot code and the nonce; switch renders three
radios with `en` and `pl` labels, the legend, `system` checked on the server, merged slot classes,
no default classes with `unstyled`, and a message override; architecture guard passes and catches a
planted literal in a fixture string.

**Done when:**
- Automated: the phase 2 tests pass; `dist/ui/theme-switch.js` starts with `"use client"`.
- Automated: Gates green (typecheck, lint, test).

## Phase 3: CSS pipeline, bridge and docs

**Discipline:** test-after. **Files:** `foundation/ui/scripts/build-css.mjs`, `foundation/ui/package.json`,
`foundation/ui/tests/styles.test.ts`, `foundation/ui/README.md`, `docs/02-module-standard.md`.

1. `scripts/build-css.mjs [distDir]`: imports `<distDir>/theme/index.js`, writes the input CSS (layer
   order, `@import "tailwindcss/utilities.css" layer(softure) source(none)`, `@source` on `src/ui`,
   the reference theme, the default tokens in `@layer softure`), runs the Tailwind CLI with
   `--minify` into `<distDir>/styles.css`, writes `<distDir>/tailwind.css`, prints the gzip size and
   exits 1 above 20 kB. `package.json` gains the `"./styles.css"` and `"./tailwind.css"` exports.
   Build script becomes `tsc -p tsconfig.build.json && node scripts/build-css.mjs`.
2. `tests/styles.test.ts`: builds into a temp dir and checks the result.
3. `README.md` (package) and docs/02 §5: install, import order, provider, boot script, switch,
   design.json, token table, `sft:` classes, layer order.

**Tests:** built `styles.css` starts its layer statements with `theme, base, softure, components,
utilities`, holds every default token, has the switch's utilities inside `@layer softure`, contains
no unprefixed utility, and is ≤ 20 kB gzip; `tailwind.css` maps every bridged token.

**Done when:**
- Automated: `npm run build` emits `foundation/ui/dist/styles.css` and `dist/tailwind.css` and prints the gzip size.
- Automated: the phase 3 tests pass; README and docs links pass the link test.
- Automated: Gates green (typecheck, lint, test).
- Manual: a page with the switch renders with default tokens in light and dark and with an override theme (screenshots).

## Risks and rollback

- Layer order misused by an app (styles imported after Tailwind) → app classes lose; mitigated by
  the README and the order statement; FD-7's example app proves the recommended order.
- Tailwind CLI behaviour change in a minor release → the styles test pins the observable output
  (layer, prefix, tokens).
- Rollback: each phase is one commit inside a new package; reverting the commits removes the
  workspace with no effect on core or other packages (root devDependencies revert with them).

## Decisions (auto)

- Complexity → medium (three phases, a new package, real trade-offs on CSS layering).
- Approach → tokens in TS, CSS generated at build (single source of truth).
- Outline → kept as written.
- Provider placement of the boot script → separate `ThemeScript` component, because it must sit in
  `<head>` while the provider wraps `<body>` content.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Token contract and theme logic

#### Automated
- [ ] 1.1 The phase 1 tests fail before the sources exist and pass after
- [ ] 1.2 `npm run build` emits `foundation/ui/dist/index.js` and `index.d.ts`
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Provider, boot script component and theme switch

#### Automated
- [ ] 2.1 The phase 2 tests pass; `dist/ui/theme-switch.js` starts with `"use client"`
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: CSS pipeline, bridge and docs

#### Automated
- [ ] 3.1 `npm run build` emits `foundation/ui/dist/styles.css` and `dist/tailwind.css` and prints the gzip size
- [ ] 3.2 The phase 3 tests pass; README and docs links pass the link test
- [ ] 3.3 Gates green (typecheck, lint, test)

#### Manual
- [ ] 3.4 A page with the switch renders with default tokens in light and dark and with an override theme (screenshots)
