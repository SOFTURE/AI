---
change_id: auth-forms-pending-label-616
reviewed: 2026-10-19
verdict: approved
---

# Plan review: auth-forms-pending-label-616

Checked plan.md against change.md, research.md, issue #616, `auth-forms.tsx` and ui's `button.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The fix is the issue's own proposal, made once in `FormShell`, which all five forms share; it matches `ActionForm` and the #615 fix. | No change. |
| 2 | Check | Markup changes (label wrapped in a grid span, spinner inside it); an app styling `classNames.submit` keeps its root class. With `unstyled` the grid classes are dropped, as in `ActionForm`. | Note it in the CHANGELOG. |
| 3 | Minor | The pending test needs an action that stays pending. | Use a deferred promise resolved at the end of the test, as in #615. |

No Critical findings.
