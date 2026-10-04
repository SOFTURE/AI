# Implementation review: billing-grant-plan-script

Reviewed: the branch diff (`modules/billing/{package.json,README.md,src/scripts/,tests/plan-scripts.test.ts}`,
`examples/next-app/{package.json,README.md,scripts/grant-plan.ts,scripts/revoke-grant.ts,e2e/billing-pricing.spec.ts}`,
`package-lock.json`) against plan.md and the plan review. Verdict: **approved**, no open findings.

## Plan conformance

| Step | Result |
| --- | --- |
| 1. Package export and dependency | Done: `./scripts` export (source, types, default) and `@softure-ai/ops` in `dependencies`; the lockfile gained the one line; the build orders ops before billing. |
| 2. Scripts | Done: `createGrantPlanScript` / `createRevokeGrantScript` in `src/scripts/plan-scripts.ts`, writing through `grantPlanManually` / `revokeManualGrant` with `adminId: null`. Plan review F1: ownership is its own select on `billing.manual_grants` (id, account, active), not the capped history; F2: `isUuid` before the query. Impossible codes (`plan_unknown` after the check, `request_closed` without a request) throw. |
| 3. Tests | Done: 15 PGlite tests in `tests/plan-scripts.test.ts` (dry run, commit, history entry, revoke from either side, every refusal with nothing written, the command output without the email). F3: the lifetime refusal leaves one grant row and `is_lifetime` unchanged. |
| 4. Example app | Done: two scripts, two `package.json` entries, a README row; the e2e "a plan granted with the grant-plan script is in the admin's history, and revoke-grant takes it back" passed locally against Postgres 16 with the built app (all 10 tests of `billing-pricing.spec.ts`). |
| 5. README | §1 lists the scripts, §4 has "Scripts" (usage, refusals, report), §12 no longer names FU-22; the package description names the scripts. |
| 6. Gates | `npm run typecheck`, `npm run lint`, `npm test` (2540 passed), `npm run build`, the example's `tsc --noEmit` green. |

## Checks

| Check | Result |
| --- | --- |
| Correctness | The billing functions' transactions run as savepoints of the script's transaction, so a dry run rolls the grant, its row and the entitlement change back together (the dry-run tests read no grant row and no entitlement row afterwards). |
| Concurrency | Locks are those of `grantPlanManually` / `revokeManualGrant` (account, entitlement, grant row), held to the outer commit. `before` is read just ahead of them, as in `grant-role`; a revoke that loses a race to the admin page refuses with the same message. |
| Errors | Expected conditions are refusals (exit code 1, nothing written); database errors propagate to `runOpsScript`, which prints them without parameters. |
| Privacy | Reports carry the user id, entitlement and grant ids only; the unit and e2e tests assert the output has no email. |
| Language | English only; `npm run lint:language` green. |

## Findings

None. No new gaps for the followups roadmap.
