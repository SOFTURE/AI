# Implementation review: ui-checkbox-field-look

Reviewed: the branch diff against plan.md, change.md and issue #340.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. The props are spread first, so `key`, `id`, `name`, `defaultChecked` and `unstyled` set by the field always win; the `Pick`s keep anything but the look out. | No change. |
| 2 | Check | Tests were red on master (all 4 new tests) and are green after; the existing `CheckboxField` and `ActionForm` tests pass unchanged. | No change. |
| 3 | Check | Docs: README `CheckboxField` paragraph with an example, CHANGELOG `0.1.16`, version 0.1.16 in `package.json` and `package-lock.json` (0.1.15 is on npm). | No change. |
| 4 | Suggestion | The issue's optional `field-<name>` id default is not taken (change.md, Decision 2); the CHANGELOG says to pass `id`. | No change. |

Gates: see plan.md Progress.
