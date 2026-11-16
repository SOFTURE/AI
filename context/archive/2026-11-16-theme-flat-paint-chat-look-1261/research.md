# Research: theme-flat-paint chat look maps (issue #1261)

Base: `master` at `842f4f7` (ui chat primitives merged). Question-level research: the concept check #1248
(`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`, answer 4, screenshots `flat-paint-*`).

## How a flat-paint look map works today

- `src/look/<name>.ts` exports `<Name>Slot` (the same union as ui's, checked by an `IsSameSet` type test as in
  `tests/app-look.test.tsx`) and `<NAME>_LOOK: Partial<Record<Slot, string>>`; the barrel re-exports both.
- The classes are theme utilities without a prefix. ui's defaults sit in `@layer softure`, which comes before
  `utilities`, so a map's class wins over ui's without `!important` (`foundation/ui/src/ui/class-names.ts`).
- `theme.css` names `./look` as a Tailwind source (`softureTheme.sources`), so an app gets the map's classes without
  scanning the package. `tests/theme-css.test.ts` compiles an app's CSS with the real Tailwind CLI and checks them.
- State comes from ui's `data-*` attributes: `in-data-done:` (Checklist), `data-[state=…]` (Stepper).

## What ui ships (#1259, `foundation/ui/src/ui/chat.tsx`)

- `ChatMessage` `<li data-role data-status>`; the bubble already takes `surface-raised` for the user, a dashed border
  for system, and `danger/50` on error, through `in-data-[…]` variants. `ChatLog` wraps the `ol` in a `role="log"`.
- `ToolCallCard` `<section data-state="pending|done|error">`; the status is copy text ("Running", "Done", "Failed");
  error border `danger/50`. Colour is the only visual difference between the three states.
- Composer buttons are ui `Button`s: `primary` (Send) paints `accent-fill` (lime) with `on-accent` through the bridge.

## Gaps against the Flat Paint rules

- In light, `surface` and `surface-raised` are both `#ffffff`: the user bubble differs from the answer only by
  alignment. A `line-strong` outline separates it (the issue's example).
- Tool card and failed message states differ by colour only; the theme's rule is a second carrier. Chosen: the
  border style (dashed while running, solid once settled), a 4 px leading edge on failure, and the state text as a
  flag with its own outline.
- Lime: nothing in ui's chat paints lime except the primary button (correct). The maps must add none.
- Headings: Tailwind's preflight resets `h1`–`h6`; the chat components use `p` for titles, so nothing breaks inside
  them. A page title around the chat needs `text-page` (README note).
- Contrast: `accessible`, `debt`, `muted` and `foreground` reach 4.5:1 on every surface in both schemes
  (`tests/contrast.test.ts`), so state text without a tint stays AA.

## Visual tests

- flat-paint has no pixel-baseline gallery (theme-notion's `visual/` is Playwright with committed baselines).
  Browser tests in the repo run in Vitest with `chromium` from `@playwright/test` and skip without a browser
  (`modules/files/tests/upload-page-browser.test.ts`, `CHROMIUM_PATH` / `PLAYWRIGHT_CHROMIUM_PATH`, set in CI).
- ui's `styles.css` can be compiled in a test with `buildCss` from `foundation/ui/scripts/build-css.mjs` and ui's
  source module (as `foundation/ui/tests/disclosure-panel-links-777.test.tsx` does).
