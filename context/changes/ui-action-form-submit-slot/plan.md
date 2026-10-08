# Plan: ui-action-form-submit-slot

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

`ActionForm` takes `classNames.submit`, added to the submit button's classes in the page and the modal branch,
with tests, README, CHANGELOG and ui 0.1.12.

**Out of scope:** other components; the adopting app's removal of its workaround.

## Findings (the reading behind the plan)

- `action-form.tsx`: `DEFAULT_CLASSES` is a `Record<ActionFormSlot, string>`, read through
  `createSlotClassGetter`, which returns the default plus the app class (only the app class when `unstyled`) or
  `undefined` when both are empty.
- `button.tsx`: `className` joins `classNames.root` after it, so the app class lands on top of the variant look
  (app classes win because the package defaults sit in `@layer softure`).
- The modal branch's submit `Button` is a child the form renders itself, so the slot reaches it directly; no
  `ModalFooter` change is needed.

## Key decisions

- **D1** `ActionFormSlot` gains `"submit"` with an empty default; both submit buttons get
  `className={slot("submit")}`. Through the slot getter, `unstyled` behaves like every other slot (the app class
  alone, which the unstyled `Button` then carries alone).
- **D2** Docs: the `ActionFormSlot` JSDoc, a README sentence next to the `cancel` one, a CHANGELOG `0.1.12` entry.

## Phase 1: submit slot (TDD)

- Tests (`tests/adoption-gaps-230.test.tsx`): the page branch's submit button carries the slot class on top of the
  package look and the `actions` wrapper does not; the modal branch's submit button carries it and Cancel does
  not; unstyled gives the submit button the app class only; without the slot the submit button's classes are
  unchanged.
- Code: `ui/action-form.tsx`; README, CHANGELOG, `package.json` 0.1.12 and the lockfile.

Done when: the new tests were seen red, then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: submit slot

#### Automated
- [x] 1.1 Submit slot tests seen red, then green
- [x] 1.2 Gates green (typecheck, lint, test, build)
- [x] 1.3 README, CHANGELOG and version 0.1.12
