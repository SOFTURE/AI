# Plan: ui-field-tooltip-hint-layout

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one component).

## Goal

`Field`'s label row lays a tooltip "?" inline after the label, through a new `tooltip` slot on its wrapper; the
row's height and the label's position stay as they were; tests, README, CHANGELOG.

**Out of scope:** the block hint (`hint` slot), `Card`'s title row.

## Findings

- `FIELD_CLASSES.label` is `text-sm font-medium text-foreground` with no leading class, so its line height is
  `text-sm`'s own. A block `labelRow` with `text-sm` has the same strut.
- The block hint path (`hintAs="block"`) renders no "?"; it must not get the label padding or a wrapper.
- `pickFieldSlots` lists the slots by name, so a new slot needs adding there, or the input fields drop it.
- `SelectField` passes its `classNames` (`ClassNames<FieldSlot>`) straight to `Field`, so it gets the slot for free.

## Key decisions

- **D1** New slot `tooltip` on a `span` that wraps the `CopyHint`: `sft:-ml-5 sft:inline-flex sft:w-5
  sft:justify-end`. The name follows `hintAs="tooltip"` and leaves `hint` meaning the block hint.
- **D2** `labelRow` → `sft:mb-1.5 sft:block sft:text-sm`; the label gets `sft:pr-5` only with a tooltip hint and not
  under `unstyled` (same rule as `Switch`).
- **D3** `pickFieldSlots` forwards `tooltip`; `InputFieldSlot` gets it through `FieldSlot`.
- **D4** Docs: JSDoc on `FieldSlot`, the README `Switch` paragraph widened to `Field`, CHANGELOG 0.1.14 line.

## Phase 1: Field (TDD)

- Tests (`tests/adoption-gaps-284.test.tsx`): with a tooltip hint the row is block `text-sm`, the label has `pr-5`
  and the wrapper the D1 classes; a block hint gives no padding and no wrapper; `classNames.tooltip` reaches the
  wrapper through `Field`, `TextField` and `SelectField`; unstyled leaves only the app's classes.
- Layout check in Chromium: the wrap check at 300–520 px (0 failures) and the row height and label text top equal
  to the old flex row.
- Code: `ui/field.tsx`, `ui/form-fields.tsx`; README, CHANGELOG.

Done when: the new tests were seen red, then green; the layout check passes; gates green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Field

#### Automated
- [x] 1.1 Field tests seen red, then green — 40f2655
- [x] 1.2 Layout check in Chromium — 40f2655
- [x] 1.3 Gates green (typecheck, lint, test, build) — 40f2655
- [x] 1.4 README and CHANGELOG — 40f2655
