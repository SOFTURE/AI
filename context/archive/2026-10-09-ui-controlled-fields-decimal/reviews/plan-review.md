---
change_id: ui-controlled-fields-decimal
reviewed: 2026-10-09
verdict: approved
---

# Plan review: ui-controlled-fields-decimal

Checked plan.md against change.md, issue #320, `amount.ts`, `form-fields.tsx`, `form-context.tsx` and their tests.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Joining digit strings before `Number` avoids the double rounding of `whole * 10^scale + fraction`; at scale 6 a whole part of 10 digits would otherwise lose units before the range check. | No change. |
| 2 | Check | `parseAmount` keeps its codes through the mapping, so `getAmountErrorMessage` and existing callers see no change; the existing `amount.test.ts` pins it. | No change. |
| 3 | Suggestion | Spreading a `key` inside a props object into JSX warns in React 19. | Taken: `key`, `value` and `defaultValue` are passed as separate JSX attributes. |
| 4 | Check | Turning the props interfaces into type aliases breaks only `interface X extends TextFieldProps`; no such use in the tree. CHANGELOG states it. | No change. |
| 5 | Suggestion | A `scale` prop on `MoneyField` would serve percent inputs directly. | No change: decision 6, not asked for; `TextField` + `normalizeDecimalInput` covers it. |

No Critical findings. Research and framing skips are justified in change.md.
