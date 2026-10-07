# Plan: ui-hint-select-toast-gaps

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases, one package).

## Goal

Every point of issue #163 lands in `@softure-ai/ui` as an optional, backward-compatible option or a fixed default,
with tests, README lines and ui 0.1.8.

**Out of scope:** other components, a CHANGELOG file (issue #158 introduces them for every package), the adopting
app's own migration.

## Findings (the reading behind the plan)

- `hint.tsx`: the bubble is `hidden={!isShown}`; the package preflight turns `[hidden]` into
  `display: none !important`, so no class can show it before React runs. Placement is fixed-position from
  `resolveBubblePlacement` with `TRIGGER_GAP_PX = 6`; before the first measure the bubble uses its absolute classes
  (`bottom-full`, side, `mb-2`).
- `select.tsx`: `measure` runs on open and on `scroll` / `resize`; nothing re-measures when an ancestor's transform
  animation ends.
- `toast.tsx`: the region is a fixed `<div role="status">` with classes only.
- `scripts/build-css.mjs` `STATIC_THEME`: the `text-*` namespace comes from the token bridge
  (`--text-sm: var(--sft-text-sm)`) with no `--text-*--line-height`; `--tracking-normal` is not defined, so
  `sft:tracking-normal` would compile to nothing.

## Key decisions

- **D1 (point 1)** add `sft:normal-case sft:tracking-normal` to the bubble's default classes and
  `--tracking-normal: 0em` to the static theme. A test on the compiled CSS proves both utilities exist.
- **D2 (point 2)** a hydration flag from `useSyncExternalStore` (server snapshot `false`, client `true`), so the
  server markup and the hydrating render agree. Before hydration (styled mode) the bubble has no `hidden`
  attribute; it is hidden by `sft:hidden` and shown by `sft:group-hover/hint:block` and
  `sft:group-focus-within/hint:block` on a `sft:group/hint` root. After hydration the state drives it as today
  (`hidden` attribute), so pin, Escape and placement keep working. Unstyled mode keeps the `hidden` attribute in
  both phases (it has no classes to show it with).
- **D3 (point 3)** prop `triggerGap` (px, default 6) on `Hint`, passed to `resolveBubblePlacement` as an optional
  `gap`. A prop rather than a token: the gap is a number the placement maths needs in px.
- **D4 (point 4)** README: "Escape closes the bubble however it opened (hover, focus or a click)" and the JSDoc.
- **D5 (point 5)** while the list is open, `Select` listens on `document` (capture) for `animationend` and
  `transitionend` and re-measures; events from inside the select itself (the chevron's rotate transition, the list)
  are ignored, since they cannot move the trigger.
- **D6 (point 6)** `ToastHost` prop `regionProps`: `id` and `data-*` attributes only, so role, live-region
  attributes and classes stay the component's.
- **D7 (point 7)** `--text-{xs…3xl,display}--line-height` in the static theme with Tailwind's default ratios
  (display = 1). Tailwind then writes `line-height: var(--tw-leading, …)`, so an explicit `sft:leading-*` still
  wins. Visible effect: package text with `text-*` and no `leading-*` gets Tailwind's line heights instead of the
  inherited one (the toast is 40 px tall, as the issue measured for the app). Controls with a fixed height
  (`h-10` inputs, buttons, options with `min-h-10`) keep their size; the impl review lists every component whose
  height changes.

## Phase 1: behaviour (TDD)

- Tests: bubble classes have `normal-case` and `tracking-normal`; server markup has no `hidden` attribute and has
  the hover / focus-within classes, client render keeps `hidden`; unstyled server markup keeps `hidden`;
  `resolveBubblePlacement` with `gap: 8`; `Hint triggerGap` reaches the placement (top differs by the gap);
  `Select` re-measures on `animationend` from an ancestor and not on the chevron's `transitionend`; `ToastHost regionProps` forwards
  `data-testid` and `id` and cannot override `role`.
- Code: `ui/hint.tsx`, `ui/select.tsx`, `ui/toast.tsx`.

Done when: the new tests were seen red, then green; gates green.

## Phase 2: CSS and docs

- Tests: compiled CSS (`styles.test.ts`) gives `.sft\:text-sm` a line height and defines `tracking-normal`,
  `normal-case`, `group-hover/hint` and `group-focus-within/hint` rules.
- Code: `scripts/build-css.mjs`; README (Hint no-JS path, `triggerGap`, Escape, `regionProps`, Select in animated
  containers, text line heights); version 0.1.8 and the lockfile.

Done when: gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: behaviour

#### Automated
- [ ] 1.1 Hint, Select and ToastHost tests seen red, then green
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: CSS and docs

#### Automated
- [ ] 2.1 Compiled CSS tests seen red, then green
- [ ] 2.2 README, version 0.1.8, gates green (typecheck, lint, test, build)
