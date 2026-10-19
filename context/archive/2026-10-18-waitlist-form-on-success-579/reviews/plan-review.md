---
change_id: waitlist-form-on-success-579
reviewed: 2026-10-18
verdict: approved
---

# Plan review: waitlist-form-on-success-579

Checked plan.md against change.md, research.md, issue #579 and `waitlist-form.tsx`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Both acceptance points are covered: an app's card through `success` plus `onSuccess` (tested), and the existing tests keep the default view. | No change. |
| 2 | Major | Calling `onSuccess` during render would run it on every re-render and before the view exists; it must run in an effect, guarded so one answer calls it once. | Plan step 2 already uses an effect with a ref; keep it. |
| 3 | Check | `<Waitlist />` cannot take functions from a server component; passing only a node there, and documenting the client route, avoids a runtime serialisation error. | No change. |
| 4 | Minor | `WaitlistFormState` is a bag of optional fields; a narrowed alias is enough here, a union refactor is out of scope. | Accepted. |

No Critical findings.
