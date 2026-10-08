# Plan review: ui-switch-hint-state-slots

Reviewed: plan.md against change.md, issue #281 and `foundation/ui/src/ui/{switch,hint,copy-hint,class-names,select,card,field}.tsx`.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | D2 keeps `sft:group/switch` under `unstyled`; if it also stays in `SWITCH_FRAME`, the styled root carries it twice. | Accepted: the marker leaves `SWITCH_FRAME` and is prepended to the root class in every mode. |
| 2 | Warning | The existing test matches `group-has-checked/switch:visible">On<`, so the visibility class must stay last in the line's class list. | Accepted: the line class is the slot class, then the behaviour classes; `stateOn` / `stateOff` defaults are empty. |
| 3 | Suggestion | Stacking needs `grid` on the `state` container; without it an unstyled switch keeps one line hidden but still takes its height. | Accepted: `sft:grid` is behaviour on `state` (D2 already lists it). |
| 4 | Suggestion | `hintProps` must not override `label`, `id` or `anchorLeft`: spread it first, as `CopyHint` does. | No change: D1 says so. |
| 5 | Check | `HintAppearance` is already exported from the package index (used by `Card`, `Field`, the form fields). | No change. |
| 6 | Check | `styles.css` is compiled from the sources (`scripts/build-css.mjs`), so the new `sft:pr-5`, `sft:-ml-5`, `sft:w-5` classes land in the CSS without a manual list. To confirm on the built file in the layout check. | No change. |
| 7 | Check | The layout check is a manual-style verification run by a script; it needs the built CSS and Chromium at `/opt/pw-browsers/chromium`. It is evidence for the review, not a test in the suite (the package has no browser tests). | No change. |

No migration, no API removal; the one visible change without new props is the label row layout, which is the fix
the issue asks for.
