# Plan review: billing-adoption-gaps

Reviewed: plan.md against change.md, issue #229 (body and first comment) and the code on master `a0dbf19`.
Verdict: **approve after fixes** (all applied to plan.md).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Exact import refused every account with a row, so re-running an adoption script (or its migration hook after a partial failure) would always fail on the second run. | Fixed: a row that already equals the imported record counts as imported (no write); only a different row is `billing.entitlement_exists`. Test added to phase 4. |
| 2 | Warning | Extending a trial of an account with paid access was not decided: refusing would block the "invite for free after a refund" case, allowing it changes nothing visible until paid access ends. | Fixed: allowed, stated in Key decisions. |
| 3 | Suggestion | The history row needs "now" to tell a current extension from a past one. | Accepted: the admin page reads the context's clock; no plan change. |
| 4 | Suggestion | A page `<h1>` changes the markup for apps that already wrap the page with their own heading. | Accepted: `heading={null}` hides it; the CHANGELOG says so. |
| 5 | Check | Lock order (account key share → pin → `lockEntitlementRow` → own row) matches `grantPlanManually`, and a refusal undoes the pin. | No change. |
| 6 | Check | Privacy: the new table is exported without `extended_by` and erased before the account; the export type grows by one field (additive). | No change. |
| 7 | Check | Migration `0010` is forward-only with a rollback line; FK index test guards point 5 in future migrations too. | No change. |

No lesson ignored: `context/foundation/lessons.md` rules on refusals writing nothing and on lock order are followed.
