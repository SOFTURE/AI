# Plan review: billing-grant-plan-script

Reviewed: plan.md, research.md against `modules/auth/src/scripts/role-scripts.ts`,
`modules/ops/src/scripts/ops-script.ts`, `modules/billing/src/server/{grants,plans,entitlements}.ts`,
`examples/next-app/{package.json,scripts/,e2e/billing-pricing.spec.ts}`. Verdict: **approved** with
the findings below folded into the steps.

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Yes: step 2 writes through `grantPlanManually` / `revokeManualGrant`, so the row is the admin page's row; step 3 proves the history lists it and both paths revoke each other's grants. |
| Unknowns answered | Dependency: ops depends on core and db only, no cycle (research). Naming: id plus email. |
| Transactions | The billing functions' own transactions become savepoints in the script's transaction; a refusal rolls the whole run back. Locks are held until the outer commit or rollback. |
| Dry run | `before`/`after` both measured inside the transaction; `executeOpsScript` rolls back without `--commit`. |
| Privacy | Reports carry the user id, never the email; step 3 asserts the printed output. |
| Example app | It already installs `@softure-ai/ops` and billing from the workspace folders; two scripts and two `package.json` entries follow `grant-role`. |
| Scope | No migration, no FU-24 work, no new server API. |

## Findings

- F1 (major, accepted into step 2): the ownership check of `revoke-grant` must not rely on the
  history listing, which reads at most 100 grants; an older active grant would be refused wrongly.
  Check the id with its own select on `billing.manual_grants` (id, account, `status = 'active'`).
- F2 (minor, accepted into step 2): validate the id's shape (`isUuid`) before querying, so a typo is
  a refusal and not a database error on the uuid cast.
- F3 (minor, accepted into step 3): assert the refusal of `grant-plan` for lifetime access comes
  from the existing lifetime check, with nothing written (row count unchanged).
