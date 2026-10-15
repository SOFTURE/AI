# Research: ui-suggested-amount-states

Input: change.md, issue #507. Depth: quick.
Snapshot: f854efc on claude/project-thread-ue4k21, 2026-10-15 09:15 CEST.

## Summary

`SuggestedAmountField` (`foundation/ui/src/ui/suggested-amount-field.tsx`) is a `MoneyField` plus one secondary
`Button` (the chip) whose text is `suggestedAmount.use` ("Use {amount}") or `suggestionLabel`. `suggestedValue` is a
required string and there is no slot for anything next to the chip. The package `Hint` and the `CopyHint` pattern
(a "?" named by a message template) already exist, so the explanation needs no new primitive.

## Current state

- `suggested-amount-field.tsx`: slots `group`, `suggestion` (+ `MoneyField` slots); the chip fills the normalized
  suggestion, calls `onValueChange` and focuses the input; replay from `useFieldValue` restarts the text.
- `messages/en.ts:63-66`: group `suggestedAmount` with one key, `use`.
- `hint.tsx`: `Hint` (`label`, `children`, `HintAppearance` = `classNames`, `triggerGap`, `isWide`).
- `copy-hint.tsx`: formats a group's `hintLabel` with values; used by `Field` and `Card`.
- `form-fields.tsx`: `MoneyField`'s `label` is a `string`, so it can fill a `{label}` template.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Component | `foundation/ui/src/ui/suggested-amount-field.tsx` | null state, hint, inline variant, row slot |
| Copy | `foundation/ui/src/messages/en.ts` | `suggested`, `useShort`, `none`, `hintLabel`, `noneHintLabel` |
| Docs | `foundation/ui/README.md`, `foundation/ui/CHANGELOG.md` | usage and migration |
| Tests | `foundation/ui/tests/suggested-amount-field-507.test.tsx` (new) | behaviour |

## Data

None.

## Tests

`npx vitest run foundation/ui` runs the package tests (jsdom, Testing Library). `tests/adoption-gaps-407.test.tsx`
covers today's chip; it must stay green unchanged. `tests/styles.test.ts` and the token guards check that classes
name defined tokens.

## Patterns to follow

- Slots through `createSlotClassGetter`, defaults in `sft:` classes on tokens (`text-muted`, `text-accent`).
- Copy through `getCopy` + `useUiCopyProps`, messages formatted with `formatMessage`.
- Link-like text buttons as in `checklist.tsx:55` (underline offset, focus outline).

## Prior work

- `context/archive/2026-10-12-ui-app-components-407/`: the component.

## SOFTURE modules

Covered by `@softure-ai/ui` itself; this extends it.

## Risks

- Changing the chip's DOM for current callers: keep the chip as before; the row wraps it only to hold a hint. Low.
- An inline "use" button with a vague accessible name: name it with `use` ("Use {amount}"), which contains the
  visible "use" (WCAG 2.5.3). Low.

## Relevant lessons

None specific.

## Answers to unknowns

- `undefined` and `null` both mean "no suggestion", so an app can pass an optional value straight through.

## Open questions

None.

## Decisions (auto)

- `suggestionHint?: ReactNode` rendered in the package `Hint`, named by `hintLabel` / `noneHintLabel` with the field's
  `label`; `suggestionHintProps?: HintAppearance` for its look. Not an `explanation` string: a node can hold a link.
- `suggested` is a template, "Suggested: {amount}", so a translation can place the amount.
