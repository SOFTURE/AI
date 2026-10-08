# Plan: ui-switch-hint-state-slots

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one component).

## Goal

`Switch` takes `hintProps`, has `stateOn` / `stateOff` / `hint` slots, keeps its state switching under `unstyled`,
lays the "?" inline with the last word of the label, and documents its derived ids; tests, README, CHANGELOG, ui
0.1.14.

**Out of scope:** `Field`'s label row (same flex row; a separate issue if an app hits it); `SwitchControl`; the
adopting app's removal of its own `Switch`.

## Findings (the reading behind the plan)

- `class-names.ts`: `createSlotClassGetter` returns the default plus the app class, or only the app class when
  `unstyled`. Defaults sit in `@layer softure`, so app classes win.
- `hint.tsx`: `HintAppearance = Pick<HintProps, "classNames" | "triggerGap" | "isWide">`; `Card` and `Field` spread
  it through `CopyHint`. `Hint` root is `inline-flex align-middle`.
- `select.tsx`: a precedent for behaviour classes outside slots (`CHEVRON_OPEN`, `CHECK_HIDDEN`), which it drops
  under `unstyled`. For `Switch` that drop is a bug, not a look: both state lines show at once.
- Tailwind prefix: the package's `sft:group-has-checked/switch:` variants read the class `sft:group/switch`. An
  app's unprefixed `group-has-checked/switch:` reads `group/switch`, which the app must put on `classNames.root`
  itself.
- Inline layout: an inline label with `padding-right: 1.25rem` reserves the room of the "?" at the end of its last
  line, and an `inline-flex` wrapper of `width: 1.25rem; margin-left: -1.25rem` draws the "?" in that room with a
  net advance of zero, so it can never be pushed to a line of its own (a break opportunity exists before an atomic
  inline even after a no-break space, CSS Text 3 §5.1, so a nbsp does not help).

## Key decisions

- **D1** `hintProps?: HintAppearance` on `Switch`, spread into its `Hint` (before `label`, `id` and `anchorLeft`,
  which stay the component's).
- **D2** Slots `stateOn` and `stateOff` (look) on the two lines. Behaviour classes are applied always, also under
  `unstyled`: `sft:group/switch` on the root, `sft:grid` on `state`, and the stacking + visibility classes on the
  two lines. Exported constants are not needed: the app styles through the slots.
- **D3** Slot `hint` on a new `span` that wraps the "?". Defaults: `labelRow` → `sft:block`, `label` gains
  `sft:pr-5`, `hint` → `sft:-ml-5 sft:inline-flex sft:w-5 sft:justify-end`. The wrapper is rendered only with a
  `hint`; without one the label has no padding (`pr-5` only with a hint).
- **D4** Docs: JSDoc on `SwitchSlot` and `SwitchProps` (ids, group marker, behaviour under `unstyled`), README
  sentence next to the `Switch` example, CHANGELOG `0.1.14`.

## Phase 1: Switch (TDD)

- Tests (`tests/adoption-gaps-281.test.tsx`): `hintProps` classes reach the trigger and bubble and `triggerGap` moves
  the open bubble; unstyled keeps one visible line per state (both visibility classes present, `sft:group/switch`
  on the root) and the slot classes reach the lines; the `hint` slot reaches the wrapper; the default label row is
  block with `pr-5` on the label and the wrapper `-ml-5 w-5`; without a hint the label has no `pr-5` and no wrapper;
  ids `<id>-description` and `<id>-hint`.
- Layout check in Chromium (Playwright, built CSS): a wrapping label at 410–420 px keeps the "?" on the line of its
  last word.
- Code: `ui/switch.tsx`; README, CHANGELOG, `package.json` 0.1.14 and the lockfile.

Done when: the new tests were seen red, then green; the layout check passes; gates green (typecheck, lint, test,
build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Switch

#### Automated
- [ ] 1.1 Switch tests seen red, then green
- [ ] 1.2 Layout check in Chromium
- [ ] 1.3 Gates green (typecheck, lint, test, build)
- [ ] 1.4 README, CHANGELOG and version 0.1.14
