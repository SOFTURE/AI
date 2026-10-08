# Implementation review: ui-switch-hint-state-slots

Reviewed: the branch diff against plan.md (Phase 1, D1–D4) and issue #281.

Verdict: **approve** (no blocking findings).

## Against the plan

- D1: `SwitchProps.hintProps?: HintAppearance`, spread into `Hint` before `label`, `id` and `anchorLeft`
  (`foundation/ui/src/ui/switch.tsx`). Matches.
- D2: slots `stateOn` / `stateOff` with empty defaults; behaviour classes (`sft:group/switch` on the root,
  `sft:grid` on `state`, `STATE_ON` / `STATE_OFF` on the lines) are joined in every mode. The marker left
  `SWITCH_FRAME`, so a styled root carries it once. Matches.
- D3: slot `hint` on a new wrapper `span` (`sft:-ml-5 sft:inline-flex sft:w-5 sft:justify-end`), `labelRow` is
  `sft:block sft:text-sm sft:leading-normal` (finding 5), the label gets `sft:pr-5` only with a hint and not under `unstyled`. Matches.
- D4: JSDoc on `SwitchSlot` (behaviour under `unstyled`, the app's own group marker) and on `description` (ids),
  README paragraph and example, CHANGELOG `0.1.14`, `package.json` 0.1.14. Matches.
- Tests: `foundation/ui/tests/adoption-gaps-281.test.tsx`, ten cases. Seen red before the code (6 of 10 failing; the
  id case, the no-hint case, the single-marker case and the hint-id case pass on both sides by design), green after.
  The existing `tests/switch.test.tsx` stays green unchanged.

## Layout check (Chromium, built `styles.css`)

A script rendered `Switch` with a 68-character label and a hint, and measured the "?" against the last line box of
the label at every even width from 300 to 520 px: the "?" must sit on the label's last line, 0–8 px after its last
glyph, and inside the row.

- New layout: 0 failures; at 410 and 420 px the label wraps to two lines and the "?" stands 4 px after the last word.
- The old flex row (same label, emulated through `unstyled` + the old `labelRow` classes): 60 failures, the "?" at
  the right edge of the row (e.g. 418 px: `tLeft` 386 px, last glyph ends at 73 px).

WebKit is not installed in this container; the mechanism (inline padding + a zero-advance atomic inline) is the one
the issue measured in both engines.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Suggestion | `Field`'s label row is the same `flex items-baseline` row and orphans the "?" of a tooltip hint the same way. Out of scope for #281 (only `Switch` was asked). | Filed as #284. |
| 2 | Check | `pr-5` is skipped under `unstyled`, together with the wrapper's defaults: an unstyled switch gets neither half of the layout, so an app styles both (`label`, `hint`) or neither. | No change; README says which classes make the layout. |
| 3 | Check | `package-lock.json` also realigns `modules/blog` (0.1.9) and `modules/seo` (0.1.7) to their released `package.json` versions; the master lockfile lagged. | Kept, named in the commit. |
| 4 | Check | Markup change without new props: one wrapper `span` around the "?" and the label row's classes. No public API removed. | No change. |

## Follow-up after the review

| # | Severity | Finding | Decision |
|---|---|---|---|
| 5 | Warning | The block row took its line height from the inherited font (16 px / 1.5), not from the label: the row grew from 21 to 24 px and the label moved 2 px down (Chromium, body 16 px / 1.5). | Fixed: `labelRow` is `sft:block sft:text-sm sft:leading-normal`, the label's own metrics. Re-measured: row 21 px, label text top and "?" top identical to the old flex row; the wrap check stays at 0 failures. |
