# Implementation review: billing-adoption-gaps

Reviewed: the branch diff against plan.md (four phases) and issue #229 (five points).
Verdict: **approve**. Every point of the issue is delivered; no open blocking finding.

## Coverage of the issue

| # | Point | Delivered | Evidence |
|---|---|---|---|
| 1 | Extend a trial in the admin page | `extendTrialManually`, `extendTrialAction`, `TrialForm`, "Extend a trial" card, history entry `source: "trial"`, `billing.trial_extensions` | `tests/trials.test.ts`, `tests/next-guards.test.ts` (extendTrialAction), `tests/admin-ui.test.tsx` (TrialForm), `tests/pages.test.tsx`, `tests/lock-races.test.ts` (grant and extension at once, Postgres) |
| 2 | Exact import | `importEntitlement(…, { mode: "replace" })`, `import-entitlements --exact` | `tests/entitlements.test.ts` ("replace mode": the issue's example, account 30 days old with a legacy trial ended yesterday, is read-only), `tests/entitlement-scripts.test.ts` |
| 3 | `<h1>` on both pages | `PageHeading`, messages `payment.heading` / `admin.heading`, `heading` prop | `tests/pages.test.tsx` (default, replaced, `null`; seen red with the heading removed) |
| 4 | Per-mail Reply-To | `OutgoingMail.replyTo`, validated like `to` | `modules/mailing/tests/send-mail.test.ts` (seen red before the change) |
| 5 | FK indexes | migration `0010` | `tests/trials.test.ts` catalog test over every billing FK (seen red without the indexes) |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The import script's refusal message used "name" with a singular "row 1". | Fixed: the message names the rows, then the reason in parentheses; the test pins the exact text. |
| 2 | Suggestion | `extendTrialManually` maps refusals before the state machine runs, so the machine's own `end_not_in_future` path is unreachable from it. | Kept: the checks are explicit and the impossible branch throws (a bug, not an expected failure). |
| 3 | Suggestion | `send-mail.ts` header named the app it was ported from. | Fixed in passing: neutral wording. The billing README's import example was neutralised the same way. |
| 4 | Check | Lock order: account key share → pin → `lockEntitlementRow` → own row, and refusals undo the pin. | Matches `grantPlanManually`; covered by the refusal tests (no row left). |
| 5 | Check | Privacy: export without `extended_by`, erase with the account; admin erased → `extended_by` NULL. | Covered by `tests/privacy.test.ts` and `tests/trials.test.ts`. |
| 6 | Check | `importEntitlement` keeps its old return type for merge callers (overload). | Typecheck of the whole tree passes; existing callers unchanged. |

## Gates

`npm run typecheck`, `npm run lint`, `npm test` (with the Postgres lock tests), `npm run build`: green on the branch.
