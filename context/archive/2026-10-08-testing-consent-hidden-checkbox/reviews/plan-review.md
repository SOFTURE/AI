# Plan review: testing-consent-hidden-checkbox

Reviewed: plan.md against change.md, issue #245, `foundation/testing/src/playwright/auth.ts`, the browser test and
`foundation/ui/src/ui/switch.tsx` (`Checkbox`).

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The red run must fail for the issue's reason, not on a slow default timeout: Playwright's `check()` waits 30 s for actionability, close to nothing in the 120 s Vitest limit but long. Give the page a short `setDefaultTimeout` in the red run only, and record the error text. | Accepted: red run with a 2 s page timeout, error quoted in impl-review. |
| 2 | Warning | `dispatchEvent("click")` on a checkbox inside a `<label>` also bubbles to the label; the label's own activation does not re-dispatch when the event target is the labelled control, so the box is toggled once. The idempotence test plus the `toBeChecked` assertion catch a double toggle. | No change: covered by D1 and the tests. |
| 3 | Suggestion | Keep the existing visible-checkbox registration test, so the backward-compatible case stays covered. | Accepted. |
| 4 | Warning | A disabled box must fail, not hang: the helper takes an optional `timeout` for its assertions, and the test passes a short one. | Accepted: `TickCheckboxOptions.timeout`. |

No migration, no API removal; a new export only. Modules that consume testing in their e2e (`examples/next-app`) keep
calling `registerAccount` with the same input.
