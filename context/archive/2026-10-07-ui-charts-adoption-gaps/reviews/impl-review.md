# Implementation review: ui-charts-adoption-gaps

Reviewed: commits `0a4ba82`, `652769b`, `6a9681f` against `plan.md` (three phases), `change.md` and issue #157.
Mode: autonomous. Gates on the final tree: `npm run typecheck`, `npm run lint`, `npm test` (305 files, 4208
tests green), `npm run build` (ui `styles.css` 5.7 kB gzip of a 20 kB budget), and the example app's `tsc` and
`next build`.

Verdict: **approve** after the fixes below (applied).

## Issue coverage

| # | Point | Where | Test |
| --- | --- | --- | --- |
| 1 | Theme cookie values | `cookieValues` on `parseThemeCookie`, `buildThemeCookie`, `getThemeBootScript`, `applyThemeChoice`, `ThemeScript`, `ThemeSwitch` | `theme-cookie.test.ts` "theme cookie values" |
| 2 | `ActionResult` without `value` | `ActionSuccess` in `action-form.tsx` (core untouched) | type test + `{ ok: true }` action in `adoption-theme.test.tsx` |
| 3 | App-wide locale | `UiLocaleProvider`, `useUiLocale`, `SoftureThemeProvider locale`, `CopyHint` | `adoption-theme.test.tsx` "UiLocaleProvider" |
| 4 | Scheme scopes | `schemeScopes` on `buildThemeCss` and the provider | "scheme scopes" |
| 5 | `ink` / `ink-outline`, `pendingLabel` | `button.tsx`; `ActionForm` uses it | "Button ink variants", "Button pendingLabel"; width measured equal in Chromium |
| 6 | Panel, standing panel, overlay token | `Modal width="panel"`, `StandingPanel`, `color-overlay` (+ `design.json` role `overlay`) | "Modal panel and overlay", "StandingPanel" |
| 7 | Card collapsible, step, done, accent, heading | `card.tsx`, `card-disclosure.tsx` | "Card" |
| 8 | `submitVariant` default | JSDoc and README (default unchanged) | — |
| 9 | `ThemeScript` and `design` | `resolveTheme` shared by provider, script and switch | "ThemeScript and ThemeSwitch with design" |
| 10 | Icons and segment constants | `ChildIcon`, `LoanIcon`; `segment-classes.ts` | "icons, segments and number inputs" |
| 11 | `slashed-zero` | `NUMBER_INPUT_CLASS` | same |
| 12 | `sideEffects` | both manifests `["*.css"]` | manifest tests in `styles.test.ts` and charts `architecture.test.ts` |
| 13 | ui as a peer, negative domain, ChartPin | charts manifest; `troughOf`, `valueTicks({ min })`, `LineChart` | `value-ticks.test.ts`, `scale.test.ts`, `line-chart.test.tsx`; `ChartPin` shipped in charts 0.1.1 |

Every new test was seen red on the code before its phase (stash of the sources), then green.

## Findings

### R1 (Warning, fixed): segment constants exported from a client module

**Evidence:** the first cut put `SEGMENT_*_CLASS` in `segmented-control.tsx` (`"use client"`). A server component
importing a value from a client module gets a client reference, not the string.

**Fix:** moved to the server-safe `segment-classes.ts`; `SegmentedControl` reads `SEGMENTED_GROUP_CLASS` from it.

### R2 (Warning, fixed): the closed `StandingPanel` was still displayed

**Evidence:** the overlay's `sft:flex` beats the user-agent `[hidden] { display: none }`, so `hidden` alone would
leave the closed panel on screen.

**Fix:** `sft:[&[hidden]]:hidden` on the overlay; the test asserts the attribute and no dialog role while closed.

### R3 (Suggestion, fixed): the step badge vanished on a white card

**Evidence:** the badge used `surface-raised`, which equals `surface` (`#ffffff`) in the light defaults; the
browser check showed a bare digit.

**Fix:** `foreground/10`, visible in both schemes (screenshots in the browser check).

### R4 (Suggestion, fixed): `StandingPanel` and `fixed` positioning

**Evidence:** rendered in place, a `fixed` overlay is positioned against an ancestor with `transform`, `filter`
or `contain`.

**Fix:** stated in the component's doc comment.

### R5 (Suggestion, follow-up issue): the same gaps in other packages

**Evidence:** `@softure-ai/blog` ships `styles.css` with `"sideEffects": false`, and eight modules take
`@softure-ai/ui` as a dependency rather than a peer.

**Decision:** out of this change's packages (each would need its own release); filed as issue #167.

### Checked, no finding

- Defaults unchanged for every existing caller: the existing ui and charts suites pass with only the markup
  expectations of `ActionForm`'s submit label updated (now wrapped in the reserve spans) and the icon count.
- Core untouched, so ui 0.1.7 and charts 0.1.2 need no new core release.
- No raw colours in components (architecture test), every new utility compiles (styles test).
- The repo text no longer names the source app in either package's sources, tests or READMEs.
