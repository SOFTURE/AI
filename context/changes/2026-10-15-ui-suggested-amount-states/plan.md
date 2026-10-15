# Plan: ui-suggested-amount-states

Input: change.md, research.md. Complexity: small (one phase).

## Goal

`SuggestedAmountField` takes `suggestedValue?: string | null`, `suggestionHint?: ReactNode` (+ `suggestionHintProps`)
and `suggestionVariant?: "chip" | "inline"` as issue #507 proposes; every new text is an overridable message; README
and CHANGELOG describe how an app switches its own suggestion row to it.

**Out of scope:** other fields, a version bump or release, any adopting app.

## Key decisions

- Below the field, one row (`suggestionRow` slot, default `sft:mt-2 sft:flex sft:flex-wrap sft:items-center
  sft:gap-x-2 sft:gap-y-1`) holds the action and the hint. In the chip variant the `suggestion` slot keeps the chip's
  classes except its top margin, which moves to the row; the chip's text and name are unchanged.
- Inline variant: `<span suggestionText>{suggested}</span> <button suggestion>{useShort}</button>`, the row muted and
  small; the button is named by `use` ("Use {amount}") and shows `useShort` ("use").
- No suggestion (`null` or left out): `<span suggestionText>{none}</span>` and the hint named by `noneHintLabel`; no
  button, in both variants.
- `suggestionLabel` keeps naming and labelling the chip; in the inline variant it replaces the visible `useShort`.
- New messages: `suggested: "Suggested: {amount}"`, `useShort: "use"`, `none: "No suggestion"`,
  `hintLabel: "Where the suggestion comes from: {label}"`, `noneHintLabel: "Why there is no suggestion: {label}"`.

## Phase 1: States, hint and inline layout

- Component, messages, tests (null and undefined, hint names in both states, inline fill + focus + name, overrides
  through `suggestionMessages` and `UiLocaleProvider`, replay unchanged), README, CHANGELOG `Unreleased`.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: States, hint and inline layout

#### Automated
- [ ] 1.1 No-suggestion state, suggestion hint and inline variant with new messages
- [ ] 1.2 README and CHANGELOG describe the props and the migration
- [ ] 1.3 Typecheck, lint, test and build green
