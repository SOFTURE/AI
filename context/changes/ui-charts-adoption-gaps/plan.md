# Plan: ui-charts-adoption-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: medium (three phases, one package each
plus docs).

## Goal

Every point of issue #157 lands as an optional, backward-compatible option of `@softure-ai/ui` or
`@softure-ai/charts`, with tests, README sections, ui 0.1.7 and charts 0.1.2.

**Out of scope:** changing defaults (point 8 is documented only), `@softure-ai/core` (see Key decisions), charts
copy and locale (charts already take `locale` per chart), the adopting app's own migration.

## Findings (the reading behind the plan)

- `theme/theme-cookie.ts` already takes `cookieName` everywhere; only the stored values are fixed (`parseThemeCookie`,
  `buildThemeCookie`, the boot script's `v==="dark"||v==="light"`).
- `ActionResult` is `Ok<undefined> | Err…` from core; `Ok<T>` requires `value`, so `{ ok: true }` does not type.
  Only `ActionForm` reads `result.ok`; nothing reads the value.
- Copy: `getCopy(group, { locale = "en" })` is called by `Card` and `Field` (server-safe, no hooks) and by the client
  components `Modal`, `ModalFooter`, `ActionForm`, `Switch`, `ThemeSwitch`; `AmountField` and `Select` read `locale`
  for number parsing and type-ahead. React context cannot be read on the server, so a provider reaches the client
  components only; `Card` and `Field` use the copy just for their hint's label, which renders in the client `Hint`.
- `buildThemeCss` writes each scheme under `[data-theme="…"]` and under `prefers-color-scheme`; nothing else.
- The adopting app's button reserves the longer of both labels in one grid cell (`::after` with
  `content: attr(data-…)`), so the button never changes width; its `ink` variants are a foreground fill and a
  foreground outline.
- The app's standing panel is always mounted (a draft inside survives closing); `isOpen` only turns on the dialog
  behaviour (role, inert outside, focus, Escape from inside, scroll lock). Its `panel` width is a full-height sheet
  from the right, 37.5rem wide from `sm`, full screen on a phone.
- The app's card: `step` + `done` badge, an accent bar beside the title, `collapsible` + `defaultOpen` with the whole
  header bar as the toggle (the header's own buttons stay clickable), collapsed content kept in the DOM (`hidden`)
  so unsaved form input survives, and a larger title for a card that is a page section.
- `ThemeScript` builds bar colours from `theme` only; the provider merges `design` first.
- `charts` imports `@softure-ai/ui` for `DEFAULT_THEME` and the palette guard; the line chart's y domain is
  `[0, peakOf(...)]` and `valueTicks` returns `(0, max]` only.

## Key decisions

- **D1 (point 2) Widen `ActionResult` in ui, not `Ok` in core.** `ActionResult` becomes
  `{ ok: true; value?: unknown } | Err…`: `{ ok: true }`, `ok()` and `ok(x)` all type. Core's `Ok<T>` keeps its
  required `value` (a typed result should carry its value), and core stays out of this release (#158 changes it).
- **D2 (point 1) `cookieValues: { light, dark }`** next to `cookieName` on every cookie function, `ThemeScript` and
  `ThemeSwitch`; values are validated as RFC 6265 cookie octets and must differ. `parseThemeCookie`'s second
  argument accepts the options object as well as the old name string.
- **D3 (point 3) `UiLocaleProvider` + `useUiLocale`**, resolved as explicit prop → provider → `en`. Client
  components resolve through the hook. `Card` and `Field` stay server-safe: their hint label moves into a small client
  component (`CopyHint`) that resolves the locale itself. `SoftureThemeProvider` takes `locale` and wraps its children
  in the provider.
- **D4 (point 4) `schemeScopes: { light?: string[]; dark?: string[] }`** on `buildThemeCss` and
  `SoftureThemeProvider`: every listed selector gets that scheme's **complete** tokens (defaults merged with the
  theme), because a section forced dark inside a light page needs every colour, not only the overridden ones.
  Selectors are validated (no `{ } ; < >`, no comment).
- **D5 (point 5) `ink` / `ink-outline` on the existing tokens** (`foreground` fill with `background` text; a
  `foreground` outline), so they follow both schemes and any scope. `pendingLabel` keeps the width with the app's
  grid-cell technique; `ActionForm` passes its pending label through it.
- **D6 (point 6) `Modal width="panel"`, `StandingPanel`, token `color-overlay`.** The overlay default keeps today's
  look (`background` at 80 %), as a literal per scheme so contrast tooling can read it.
- **D7 (point 7) Card props `step`, `done`, `accent`, `collapsible`, `defaultOpen`, `headingLevel` (2–4),
  `headingSize` (`card` | `section`).** Collapsing is a client `CardDisclosure`; `Card` stays server-safe. Accent
  tones are the semantic tokens (`accent`, `success`, `warning`, `danger`, `neutral` = foreground).
- **D8 (point 8)** document the `primary` default in the JSDoc and README.
- **D9 (point 9)** `ThemeScript` and `ThemeSwitch` take `design`; one helper (`resolveTheme`) merges `design` then
  `theme` for the provider, the script and the switch.
- **D10 (point 10)** `ChildIcon`, `LoanIcon`; `SEGMENTED_GROUP_CLASS`, `SEGMENT_ACTIVE_CLASS`, `SEGMENT_IDLE_CLASS`
  for an app's own segment buttons (the `*_CLASS` naming of `INPUT_CLASS`).
- **D11 (points 11, 12)** `sft:slashed-zero`; `"sideEffects": ["*.css"]` in both packages.
- **D12 (point 13)** `@softure-ai/ui` becomes a peer dependency of charts (`^0.1.6`) and a dev dependency for the
  workspace. The y domain becomes `[min(0, lowest), max(0, highest)]`; `valueTicks` gains a `min` option and returns
  round ticks on both sides of zero (zero excluded, the baseline is drawn at zero); the baseline moves to `y(0)`.

## Phase 1: theme, locale and copy (TDD)

- Tests: cookie values round-trip (parse, build, boot script, apply), invalid values throw; `schemeScopes` CSS
  (complete scheme per selector, unsafe selector throws); `ThemeScript design` bar colours; locale provider
  (explicit > provider > `en`) for `Modal`, `Field` hint label, `Card` hint label, `ActionForm`, `ThemeSwitch`,
  `AmountField`; `SoftureThemeProvider locale`.
- Code: `theme/theme-cookie.ts`, `theme/theme-css.ts`, `theme/resolve-theme.ts` (new), `ui/locale.tsx` (new),
  `ui/copy-hint.tsx` (new), `ui/theme-script.tsx`, `ui/theme-switch.tsx`, `ui/softure-theme-provider.tsx`, the
  components above.

Done when: the new tests were seen red, then green; gates green.

## Phase 2: components (TDD)

- Tests: (`StandingPanel` also: Escape inside a nested modal closes only the modal.) `ActionResult` accepts `{ ok: true }` (type test plus a submit); `ink` / `ink-outline` classes;
  `pendingLabel` markup (reserve attribute, label swap, spinner); `Modal width="panel"`; `StandingPanel` (closed:
  no dialog role, no inert; open: role, `aria-modal`, inert outside, Escape from inside closes, from outside not);
  overlay uses the token; Card badge, accent, heading level and size, collapsible toggle (`aria-expanded`,
  `hidden`, the header's own button still works); icons; segment constants; `NUMBER_INPUT_CLASS` has
  `slashed-zero`; compiled CSS contains the new utilities (no silent empty class).
- Code: `ui/action-form.tsx`, `ui/button.tsx`, `ui/modal.tsx`, `ui/card.tsx`, `ui/card-disclosure.tsx` (new),
  `ui/icons.tsx`, `ui/segmented-control.tsx`, `ui/field.tsx`, `theme/tokens.ts`, `theme/design-json.ts` (map
  `overlay`), messages (expand / collapse copy, en and pl).

Done when: tests seen red, then green; gates green; the new pieces seen in a browser (light and dark).

## Phase 3: packaging, charts and docs

- Tests: `sideEffects` of both packages (repo test); charts: `valueTicks` with `min`, a chart with negative values
  (baseline at zero, ticks below zero, points below the baseline); charts' manifest has ui as a peer.
- Code: both `package.json` files, root lockfile, `charts/src/scale/value-ticks.ts`, `charts/src/scale/scale.ts`
  (`troughOf`), `charts/src/svg/line-chart.tsx`.
- Docs: both READMEs (new options, the `primary` default of `ActionForm`, the locale provider, scopes, panel); the
  `templates/package` stays `false` (a package without CSS). Versions ui 0.1.7, charts 0.1.2.

Done when: gates green (typecheck, lint, test, build) and the e2e app still builds.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: theme, locale and copy

#### Automated
- [ ] 1.1 Theme and locale tests seen red, then green
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: components

#### Automated
- [ ] 2.1 Component tests seen red, then green
- [ ] 2.2 Compiled CSS carries the new utilities
- [ ] 2.3 Gates green (typecheck, lint, test)

#### Manual
- [ ] 2.4 Button, panel, card seen in a browser, light and dark

### Phase 3: packaging, charts and docs

#### Automated
- [ ] 3.1 Charts negative-domain tests seen red, then green
- [ ] 3.2 Manifests, READMEs and versions
- [ ] 3.3 Gates green (typecheck, lint, test, build)
