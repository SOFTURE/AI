# Implementation review: ui-card-panel-footer-gaps

Reviewed: the diff of `claude/project-thread-4d80ai` against `master` and `plan.md`. Verdict: **approved**, no
blocking findings.

## Plan conformance

| Decision | Delivered | Evidence |
|---|---|---|
| D1 `HintAppearance` through `CopyHint` to `Card`, `Field`, form fields | yes | `hint.tsx` type; `copy-hint.tsx` spreads it before `label`/`id`/`anchorLeft`; `card.tsx`, `field.tsx`, `form-fields.tsx` (`TextField`, `PasswordField`, `MoneyField`, `SelectField`) pass `hintProps` |
| D2 `headingLevel` 1–3 on `Modal` and `StandingPanel`, default 2 | yes | `modal.tsx` `ModalHeadingLevel`; both render `Heading` with the title id |
| D3 `cancel` slot on `ModalFooter` and `ActionForm` | yes | `ModalFooter` passes `classNames.cancel` as the Cancel `Button`'s `className`; `ActionForm` forwards it |

Tests: `foundation/ui/tests/adoption-gaps-218.test.tsx`, 11 cases; 10 were red before the code (the default-gap case
is the guard that stays green). The whole ui suite (414 tests), typecheck, lint and build are green.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Suggestion | `Card`'s `unstyled` does not reach its hint (pre-existing: the hint stays styled). | Out of scope for #218; `hintProps.classNames` now lets an unstyled app style it. No change. |
| R2 | Suggestion | `CheckboxField` / `Switch` hints still take no appearance. | Not in the issue; recorded here, a new issue if an app needs it. |
| R3 | Suggestion | `appearance` is spread first, so a caller cannot override `label`, `id` or `anchorLeft` through it; `Pick` already prevents that at the type level. | Intended. |

Backward compatibility: no default changed (`h2`, 6 px gap, Cancel classes); every addition is optional.
