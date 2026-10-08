# Plan review: ui-field-tooltip-hint-layout

Reviewed: plan.md against change.md, issue #284 and `foundation/ui/src/ui/{field,form-fields,copy-hint}.tsx`.

Verdict: **ready to implement** (no blocking findings).

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `labelRow` is a `div` whose font size comes from the page; without `text-sm` the block row takes a 24 px strut where the flex row was 20 px (the pitfall #281 measured). | No change: D2 already sets `sft:text-sm`; the layout check measures the height. |
| 2 | Suggestion | Existing tests match `</label><span` after the label; the wrapper keeps that order, so they stay green without edits. | No change. |
| 3 | Check | `PasswordField` and `MoneyField` reach `Field` through `pickFieldSlots` like `TextField`; one test through `TextField` covers the forwarding. | No change. |
| 4 | Check | `Field` is server-safe; the wrapper is a plain `span`, no client code added. | No change. |
