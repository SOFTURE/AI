# Implementation review: ui-field-tooltip-hint-layout

Reviewed: commit 40f2655 against plan.md (Phase 1, D1–D4) and issue #284.

Verdict: **approve** (no blocking findings).

## Against the plan

- D1: `FieldSlot` gains `tooltip`, a `span` around the `CopyHint` with `sft:-ml-5 sft:inline-flex sft:w-5
  sft:justify-end` (`foundation/ui/src/ui/field.tsx`). Matches.
- D2: `labelRow` is `sft:mb-1.5 sft:block sft:text-sm`; the label gets `sft:pr-5` only with a tooltip hint and not
  under `unstyled`. Matches.
- D3: `pickFieldSlots` forwards `tooltip` (`form-fields.tsx`). Matches.
- D4: JSDoc on `FieldSlot`, README paragraph widened to `Field`, CHANGELOG 0.1.14 line. Matches.
- Tests: `foundation/ui/tests/adoption-gaps-284.test.tsx`, four cases. Seen red before the code (3 of 4; the
  block-hint case passes on both sides by design), green after; the whole ui suite (449 tests) green.

## Layout check (Chromium, built `styles.css`, page font 16 px / 1.5)

`TextField` with a tooltip hint, a 70-character label, every even width from 300 to 520 px: new layout 0 failures,
the old flex row 98. Short label: the label text stands at the same place (top 17 px in both); the row is 20 px
(old: 24 px, stretched by the baseline-aligned "?"), the same as a row without a "?".

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A field with a tooltip hint loses 4 px above its control (24 → 20 px row). Visible on adoption, but it makes fields with and without a "?" line up side by side, which the old row broke. | Kept and stated in the CHANGELOG. |
| 2 | Check | `SelectField` gets the slot through its own `ClassNames<FieldSlot>` (test 4). | No change. |
| 3 | Check | No client code added to the server-safe `Field`. | No change. |
| 4 | Critical | With both label rows off `flex items-baseline`, no ui component wrote `sft:items-baseline`, so it left `styles.css`; `modules/billing` (`PricingTiles` price row) writes it, and its architecture test failed in the pre-push run. A released billing on ui 0.1.14 would lose the baseline alignment. The class is the only one the change dropped (class sets of `foundation/ui/src/ui` compared with master). | Fixed: `foundation/ui/src/ui/retained-classes.ts` keeps it in the compiled sheet, with the rule for removing it. |

## Gates

`npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` runs in the `pre-push` hook.
