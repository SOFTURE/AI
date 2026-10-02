# Research: ui-primitives

Input: change.md, roadmap FD-6, research.sources (`docs/`, `../../FIRE_TRACKER/`). Depth: normal.
Snapshot: 34fd0b9 on claude/fd-6-ui-primitives-7j5g3v, 2026-10-02 14:20 Europe/Warsaw.
Method: one researcher, no subagents; the source is one folder (`FIRE_TRACKER/src/components/`) read
file by file, plus `foundation/ui/` and `foundation/core/` in this repo.

## Summary

`@softure-ai/ui` (FD-5) ships tokens, `SoftureThemeProvider`, `ThemeScript` and `ThemeSwitch`, with
the slot helper `getSlotClass` (`foundation/ui/src/ui/class-names.ts:9`) and per-call `locale` plus
partial `messages` (`foundation/ui/src/ui/theme-switch.tsx:13-16,77`). Every FD-6 primitive exists in
FIRE_TRACKER `src/components/` and ports with three systematic edits: classes get the `sft:` prefix
and FIRE role names map to the `--sft-*` tokens (`debt` → `danger`, `line-strong` → `border-strong`,
`accessible` → `success`, `locked` → `warning`); inline Polish copy moves to `messages`; domain props
are dropped. Two blockers found in the CSS pipeline: the package's internal Tailwind theme defines no
`--spacing` base, no `--container-*`, `--leading-*` or `--animate-*`, so `sft:h-10`, `sft:max-w-md`
or `sft:animate-spin` emit nothing today (`foundation/ui/scripts/build-css.mjs:31-37`). FIRE tests
components only as static markup plus Playwright; behaviour tests (focus trap, Escape, listbox keys)
need a DOM environment in Vitest, which the repo does not have yet.

## Current state

- Package API: `foundation/ui/src/index.ts:3-5` re-exports `theme/` and `ui/` and `uiMessages`.
  `src/ui/index.ts` exports `ClassNames`, the provider, `ThemeScript` and `ThemeSwitch`.
- Slots: `ClassNames<Slot>` and `getSlotClass({ slot, defaults, classNames, unstyled })`
  (`src/ui/class-names.ts:2-19`): defaults plus app class, or only the app class when `unstyled`.
- Copy: `UiMessages = typeof en` (`src/messages/index.ts:5`), only the `themeSwitch` group today
  (`src/messages/en.ts:1-8`). Components merge with `mergeMessages(uiMessages, { [locale]: { group: messages } })`
  (`src/ui/theme-switch.tsx:77`). `formatMessage` fills `{name}` placeholders
  (`foundation/core/src/i18n.ts:58`).
- `ThemeSwitch` is a native radio group in a `fieldset` with slots `root, legend, options, option,
  input, label` (`src/ui/theme-switch.tsx:11,99-120`); FIRE's `SegmentedControl` has the same
  structure with a screen-reader-only legend (`FIRE_TRACKER/src/components/switch.tsx`, `SegmentedControl`).
- CSS: `build-css.mjs` compiles `src/ui/` with `@import "tailwindcss/utilities.css" layer(softure)
  source(none)` and `@theme inline reference prefix(sft)` built from the tokens plus `STATIC_THEME`
  (`--spacing-0` and four font weights only, `scripts/build-css.mjs:31-37`). Tokens map
  `space-N` → `--spacing-N` for N 1…8 (`src/theme/theme-css.ts:92-100`). No default Tailwind theme is
  imported, so any utility that needs a theme variable outside that list compiles to nothing.
  Current size 1.6 kB gzip of a 20 kB budget (`npm run build` output).
- Architecture test: raw colours only (`foundation/ui/tests/architecture.test.ts:6-26`). NFR-3 also
  requires "no inline copy or `next/link`" in `ui/` (`context/foundation/prd.md:89-90`); FD-5 deferred
  that test to FD-6 (`context/archive/2026-10-02-ui-tokens-theme/plan.md:16-17`).
- Tests run in `environment: "node"` (`vitest.config.mts:27`); component tests render with
  `renderToStaticMarkup` (`foundation/ui/tests/components.test.tsx:1`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Components | `foundation/ui/src/ui/*.tsx` (new) | the primitives |
| Copy | `foundation/ui/src/messages/{en,pl}.ts` | every visible and ARIA string |
| CSS build | `foundation/ui/scripts/build-css.mjs` (`STATIC_THEME`) | spacing, container, leading, animation theme values |
| Theme switch | `foundation/ui/src/ui/theme-switch.tsx` | optional move onto `SegmentedControl` |
| Tests | `foundation/ui/tests/*.test.tsx`, `architecture.test.ts` | ported FIRE tests, DOM behaviour, copy guard |
| Tooling | root `package.json`, `package-lock.json` | a DOM environment for Vitest |
| Docs | `foundation/ui/README.md`, `docs/02-module-standard.md` §5 | usage of the primitives |

## Data

None. No database, migrations or persisted state; the only client state is the toast announcement
store (module-level, `FIRE_TRACKER/src/components/toast.tsx`, `announceToast`).

## Tests

- FIRE baseline (static markup + pure functions): `button.test.tsx` (sizes, data attributes, no submit
  by default, pending spinner and `aria-busy`, `IconButton` name), `modal.test.tsx` (heading, labelled
  by title, described by subtitle, body/footer order, Cancel disabled while pending, error in footer,
  `nextFocusTarget`), `toast.test.ts` (`isToastVisible`, two equal announcements are two tokens,
  no replay on remount), `select.test.tsx` (closed markup: combobox, hidden input, first option
  fallback, disabled sends nothing; `resolveListPlacement`), `select-keys.test.ts` (open/close keys,
  arrows clamp, Home/End/PageUp/PageDown, Escape, Tab commits, typeahead), `switch.test.tsx`
  (native checkbox with `role="switch"`, label `for`, description in `aria-describedby`, Checkbox
  error), `form-fields.test.tsx` (error id first in `aria-describedby`, money normalisation, password
  without default, SelectField), `hint.test.tsx` (`role="tooltip"`, focusable trigger with name,
  `resolveBubblePlacement` flip and clamp), `action-form.test.tsx` (page vs modal layout, pending
  label), `icons.test.tsx` (one frame for every icon).
- FIRE keyboard and focus behaviour lives in Playwright (`integration/modal.test.ts:88-141`: Tab
  cycle, Escape returns focus, background `inert`; `integration/select-listbox.test.ts:57-113`:
  Escape closes the list first, arrows plus Enter commit, outside click closes without change;
  `integration/form-controls.test.ts:106,288`: pinned hint closes on Escape and on Tab out).
- Here: `npm test` (Vitest, root config). Gap: no DOM environment, so the Playwright-only behaviour
  has no home until FD-7's e2e.

## Patterns to follow

- Component shape: `"use client"` only where there are hooks; slots typed as a union and resolved
  with `getSlotClass`; `locale` (default `en`) plus `messages?: DeepPartial<UiMessages[group]>`
  (`foundation/ui/src/ui/theme-switch.tsx:13-26,77-78`).
- Classes: `sft:` prefix, token utilities (`sft:bg-surface`, `sft:text-muted`), durations as
  `sft:duration-(--sft-duration-fast)` (`foundation/ui/README.md`, "How the CSS is built").
- Tests in `foundation/ui/tests/`, one file per area, exact assertions on markup
  (`foundation/ui/tests/components.test.tsx:84-97`).
- Errors as values: `Result`, `ok`, `err` with namespaced codes (`foundation/core/src/result.ts:4-30`).

## Prior work

- `context/archive/2026-10-02-ui-tokens-theme/`: token contract, the `sft:` prefix and layer order;
  explicitly left the DOM environment and the inline-copy architecture test to FD-6.
- `context/archive/2026-10-02-core-contract/`: `Locale`, `mergeMessages`, `formatMessage`, `Result`.
- `docs/01-module-assessment.md` lists FIRE `src/components/*` as the UI source.
- No other change touches `foundation/ui/` (FD-4 owns `foundation/db/`, FD-7 `examples/`).

## SOFTURE modules

Not applicable: this change *is* the `@softure-ai/ui` primitives module; nothing else covers it.

## Risks

- **Breadth** (likely): eighteen components across seven files. Mitigation: phases by dependency
  (button/icons → feedback/card/hint → fields/select/switch → modal/toast/action form).
- **Silent CSS gaps** (certain without a fix): utilities whose theme value is missing compile to
  nothing and a markup test cannot see it. Mitigation: extend `STATIC_THEME` and add a styles test
  that asserts the compiled CSS contains representative rules (`.sft\:h-10`, `.sft\:animate-spin`).
- **Concurrent edits** (low): FD-4 runs in parallel but touches `foundation/db/`; both touch
  `package-lock.json` (roadmap rule: take master's lockfile, then `npm install`).
- **CSS budget** (low): FIRE's component classes are large but the budget has 18 kB of room.

## Relevant lessons

L-001: the package keeps building with `tsc`; new client files keep `"use client"` in `dist/`.

## Answers to unknowns

- **Which FIRE components carry domain props to drop?** `Card`: `accent` (financial meanings
  `accessible/locked/debt`), `step`/`done` (setup sequence), `collapsible` (depends on
  `CardDisclosure`), `heading` (dashboard scale). `Stat`: `tone` values are financial; map to generic
  `success/warning/danger/muted`. `Button`: variants `ink`/`ink-outline` (landing palette) and
  `zawijaj`. `form-fields.tsx`: `SuggestedAmountField` and `ColorField` (domain and raw colours).
  `MoneyField`: `normalizeAmountInput` is Polish-only (space groups, comma decimal,
  `FIRE_TRACKER/src/lib/money.ts:154`); it needs a locale. `Modal`: `StandingPanel` (one screen's
  layout). `Select` typeahead lower-cases with a hard-coded `"pl"` locale (`select-keys.ts`).
  Inline copy to move: the modal close and cancel labels, the pending label of the action form, and
  the two hint-name templates of `Field` and `Card` (all Polish literals in FIRE).
- **Keyboard behaviour worth porting from FIRE integration tests?** Yes, as DOM tests: modal Tab
  cycle, Escape and focus return, background `inert`; listbox Escape-first, arrows plus Enter,
  outside click; hint pin and Escape. Layout-dependent checks (viewport fit at 320 px, sheet on
  phone) stay with FD-7's Playwright; their pure placement functions are unit-tested here.
- **Which DOM environment?** Measured: `happy-dom` 20.14.5 runs in Vitest 5 with a per-file
  `// @vitest-environment happy-dom` docblock; it has `inert`, `requestAnimationFrame`,
  `CSS.escape`, `:disabled` matching and a non-empty `getClientRects()`. `@testing-library/react`
  16.3.3 supports React 19 (peer range checked with `npm view`).

## Open questions

- Locale provider vs per-call `locale`: **decided** (auto) per call, as FD-5 did; a provider would
  force every primitive to be a client component (context), and `Button`/`Card` are server-safe.
- `LinkComponent`: **decided** (auto) a `LinkComponent` prop on `ButtonLink`, defaulting to `<a>`;
  it is the only primitive that renders a link.
- Move `ThemeSwitch` onto `SegmentedControl`: **decided** (auto) yes, keeping its slots and markup,
  so FD-5's tests stay green unchanged.
- DOM environment: **decided** (auto) `happy-dom` per file, `node` stays the default.

## Decisions (auto)

- Depth normal: no data, auth or money storage; UI breadth only.
- The four decisions above, by evidence and the safer option.
