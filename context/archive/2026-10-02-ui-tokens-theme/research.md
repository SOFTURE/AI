# Research: ui-tokens-theme

Input: change.md, roadmap FD-5, research.sources (`docs/`, `../../FIRE_TRACKER/`). Depth: normal.
Snapshot: cbc85aa on claude/fd-5-ui-tokens-theme-ohfdkh, 2026-10-02 11:50 UTC.

## Summary

`foundation/ui/` is an empty scaffold (a README and empty `src/{messages,ui}`, `tests/`), not a
workspace yet. Everything FD-5 names is new. The token contract is fixed by docs/02 §5
(`docs/02-module-standard.md:92-110`); FIRE_TRACKER supplies the working mechanism to port: role
variables in four selector blocks (`FIRE_TRACKER/src/app/globals.css:54,127,149,170`), a cookie plus a
synchronous `<head>` script that sets `data-theme` before first paint (`src/lib/theme.ts:135`), and a
switch that reads the cookie through `useSyncExternalStore` (`src/components/theme-switch.tsx:44-45`).
Both roadmap unknowns are answered by experiment (below): Tailwind 4.3.3 compiles a package's
components to static CSS with `@theme inline reference prefix(sft)` and
`@import "tailwindcss/utilities.css" layer(softure) source(none)`, and every utility then reads a
`--sft-*` token directly. React, Tailwind and their types are not installed in the repo yet.

## Current state

- `foundation/ui/README.md:1-20`: status "wave 0 · not implemented", lists tokens, theme switch and
  primitives. No `package.json`, so `findWorkspaces` (`scripts/build-workspaces.mjs`) skips it.
- `@softure-ai/core` (FD-3) exports `Locale`, `LOCALES`, `DeepPartial`, `Dictionaries`,
  `mergeMessages` (`foundation/core/src/i18n.ts:4-56`) and `Result`/`ok`/`err`
  (`foundation/core/src/result.ts`). No UI-wide locale provider exists; modules take a `locale`
  and partial `messages` per call (`foundation/core/README.md:28-46`).
- Root devDependencies have no `react`, `react-dom`, `@types/react*`, `tailwindcss` or
  `@tailwindcss/cli` (`package.json:14-25`); `lightningcss` is present only transitively (vite).
- `tsconfig.base.json` already sets `"jsx": "react-jsx"` and `DOM` libs, so `.tsx` typechecks once
  `@types/react` is installed.
- FIRE mechanism, end to end: `layout.tsx:140-143` renders `THEME_BOOT_SCRIPT` first in `<head>`
  with `suppressHydrationWarning` on `<html>` (`layout.tsx:137`); the script reads cookie `motyw`
  and sets `data-theme` plus `meta[name=theme-color]` (`theme.ts:135`); CSS picks the role set from
  `:root` (light), `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`,
  `[data-theme="dark"]` and `[data-theme="light"]` (`globals.css:54-190`); the switch writes the
  cookie and the attribute in one step (`theme.ts:141`, `applyThemeChoice`). The server never reads
  the cookie, so routes stay static (`theme.ts:12-14`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Package shell | `foundation/ui/{package.json,tsconfig*.json,README.md}` | make it a workspace, per `templates/package/` |
| Tokens and theme | `foundation/ui/src/theme/*` | contract, defaults, CSS generation, design.json import, cookie, boot script |
| Components | `foundation/ui/src/ui/*` | `SoftureThemeProvider`, `ThemeScript`, `ThemeSwitch` |
| Copy | `foundation/ui/src/messages/{en,pl,index}.ts` | switch labels (FR-7, NFR-6) |
| CSS build | `foundation/ui/scripts/build-css.mjs`, `dist/styles.css`, `dist/tailwind.css` | compiled CSS in `@layer softure`, Tailwind bridge, NFR-7 size |
| Root tooling | `package.json`, `package-lock.json` | React, Tailwind CLI and types as devDependencies |
| Docs | `docs/02-module-standard.md` §5 | record the class prefix, layer order and the token additions |

## Data

None. No database, no migrations.

## Tests

- Vitest runs `foundation/*/{src,tests}/**/*.test.{ts,tsx}` in `environment: "node"`
  (`vitest.config.mts:33-37`); no DOM environment is installed. Components can be checked with
  `react-dom/server` `renderToStaticMarkup`; cookie and attribute logic with a fake document, as
  FIRE does (`FIRE_TRACKER/src/lib/theme.test.ts:11-38`, which runs the boot script through
  `new Function`).
- `tests/repo/packages.test.ts` covers the new workspace automatically: name, ESM, `files: ["dist"]`,
  build script `^tsc -p tsconfig.build.json( && …)?$` (line 64), code exports ordered
  source/types/default (lines 71-83, string exports such as `./styles.css` are skipped), and pl/en
  key parity when `src/messages/en.ts` exists (lines 94-102).
- The language gate allows Polish only under a `messages/` folder (`scripts/check-language.mjs:33-49`).
- Command: `npm test` (all), `npx vitest run foundation/ui` (package).

## Patterns to follow

- Package shape: `foundation/core/package.json` (exports with the `@softure-ai/source` condition,
  `sideEffects: false`, `files: ["dist"]`) and `foundation/core/tsconfig.build.json` (excludes tests,
  `customConditions: []`).
- Dictionaries: `foundation/core/src/messages/{en,pl,index}.ts` (`pl` typed against `en`).
- Expected failures as `Result` (`foundation/core/src/result.ts`), boundary input narrowed with zod
  (core depends on `zod ^4.6.5`).
- Code comments in English; FIRE comments are Polish and are not copied.

## Prior work

- `context/archive/2026-10-02-monorepo-tooling/research.md:126,168-169`: FD-1 left `./styles.css`
  and the Tailwind CLI step to FD-5; build stays `tsc` first (L-001).
- `context/archive/2026-10-02-core-contract/`: FD-3 fixed the messages and Result APIs used here.
- `context/changes/ui-primitives/change.md`: FD-6 shares `foundation/ui/` and builds the primitives
  on this pipeline; FD-5 must not add primitives beyond the switch.

## SOFTURE modules

Not applicable: this change creates the UI foundation module itself.

## Risks

- **Layer order.** `@layer` precedence follows the order layers are first declared. If the app's
  Tailwind declares `theme, base, components, utilities` before `softure`, softure ends up above the
  app's utilities and app classes stop winning; if softure sits below `base`, Tailwind's preflight
  (`button { background-color: transparent }`) beats component styles. Measured: a `styles.css`
  that starts with `@layer theme, base, softure, components, utilities;` and is imported before
  `@import "tailwindcss"` yields `properties, theme, base, softure, components, utilities` in the
  app's output. Mitigation: ship that statement first in `styles.css` and document the import order.
- **Provider overrides vs the dark default.** An unlayered override written on plain `:root` would
  beat the layered dark block in "system + dark OS", leaking a light value into dark mode. Mitigation:
  scheme tokens are emitted per scheme under both the attribute and the media query, never on bare `:root`.
- **CSS injection.** Token values land in a `<style>` element; a value with `;`, `{`, `}` or `<`
  could break out. Mitigation: validate every value before emitting.
- **Hydration.** The boot script changes `<html data-theme>` before hydration; the app needs
  `suppressHydrationWarning` on `<html>` (FIRE `layout.tsx:137`). Documented, not enforceable here.
- **Lockfile conflicts** with FD-2/FD-4, which also touch `package-lock.json`: roadmap rule, take
  master's lockfile and re-run `npm install`.
- **CSP.** The boot script is inline; a strict CSP needs a nonce or hash. Mitigation: `nonce` prop.

## Relevant lessons

- L-001: the build is `tsc -p tsconfig.build.json` first; the CSS step follows with `&&`, and the
  `"use client"` directive of the switch must survive in `dist/`.

## Answers to unknowns

1. **How to compile Tailwind-authored components to static CSS per package?** Answered by
   experiment with tailwindcss 4.3.3 and @tailwindcss/cli 4.3.3:
   - `@theme inline reference prefix(sft) { --color-surface: var(--sft-color-surface); … }` emits no
     theme variables and generates `.sft\:bg-surface { background-color: var(--sft-color-surface) }`.
     Without `reference` the prefix makes Tailwind emit `--sft-color-surface: var(--sft-color-surface)`
     on `:root`, a self-reference that invalidates the token; without `inline` utilities read
     `var(--sft-spacing-3, var(--sft-space-3))`.
   - `@import "tailwindcss/utilities.css" layer(softure) source(none);` plus an explicit
     `@source` puts every utility inside `@layer softure` and scans only the package's own files.
   - Class syntax is Tailwind's prefix form, `sft:bg-surface` (`sft:hover:…` for variants), so docs/02's
     "`sft-*` classes" becomes "`sft:` classes". Tailwind's internal `@property --tw-*` rules and its
     `@layer properties` fallback stay outside `softure`; both are identical to what an app's Tailwind
     emits, so duplicates are harmless.
   - Durations have no Tailwind namespace (FIRE `globals.css` comment at line 66): use
     `sft:duration-(--sft-duration-fast)`.
   - A probe with one utility-heavy element compiled to 557 bytes gzip; NFR-7's 20 kB budget is far.
2. **Token naming vs FIRE semantic names (mapping table).** Decided (auto), docs/02 §5 names plus two
   FIRE roles the primitives need:

   | FIRE role | `--sft-*` token | Note |
   | --- | --- | --- |
   | `--background` | `--sft-color-background` | |
   | `--surface` | `--sft-color-surface` | |
   | `--surface-raised` | `--sft-color-surface-raised` | |
   | `--foreground` | `--sft-color-foreground` | |
   | `--muted` | `--sft-color-muted` | |
   | `--border` | `--sft-color-border` | |
   | `--line-strong` | `--sft-color-border-strong` | added: 3:1 control outlines (FIRE contrast 3.03/3.88) |
   | `--accent` | `--sft-color-accent` | |
   | `--accent-fill` | `--sft-color-accent-fill` | |
   | `--accent-fill-hover` | `--sft-color-accent-fill-hover` | added: hover of the primary fill |
   | `--on-accent` | `--sft-color-on-accent` | |
   | `--debt` | `--sft-color-danger` | generic name; FIRE values as defaults |
   | `--accessible` | `--sft-color-success` | generic name |
   | `--locked` | `--sft-color-warning` | generic name |
   | (focus ring = `--accent` in FIRE) | `--sft-color-focus` | |
   | `--duration-{fast,base,slow}` | `--sft-duration-{fast,base,slow}` | 160/200/240 ms |
   | ease-out-soft | `--sft-ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` |

   Domain palettes (FIRE's `ink`, `lime`, `paper`…) are not tokens; they are default values.
3. **design.json input.** Answered: FIRE's `.impeccable/design.json` is `schemaVersion: 2` with
   `themes.{light,dark}.roles` (role name to colour) and `themes.{light,dark}.themeColor`; the rest
   (`extensions`, `components`, `narrative`) is documentation. The import maps roles through the
   table above and reports unknown roles instead of failing.

## Open questions

- Light and dark scope for non-colour tokens (fonts, sizes, radius, space, motion): **decided**
  (auto): colours and shadows are per scheme; the rest is shared and lives on `:root`. A theme input
  therefore has `light`, `dark` and `shared` parts (docs/02 named only `light` and `dark`).
- Cookie name and values: **decided** (auto): `sft-theme` = `light | dark`, absent = system; name
  configurable. FIRE's apex-domain logic becomes an optional `cookieDomain`.
- DOM test environment: **decided** (auto): none in FD-5; server rendering plus a fake document
  covers the behaviour, and FD-6 picks the DOM environment for interaction tests.
- `@softure-ai/core` version range in ui's dependencies: **decided** (auto): `^0.0.0`, matching the
  unpublished workspace; FD-8 bumps both to 0.1.0.

## Decisions (auto)

- Depth `normal` (no data, auth or money).
- Unknowns 1-3 resolved by experiment and by the FIRE source; no escalation.
