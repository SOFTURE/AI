# Plan: billing-grant-plan-script

Input: change.md, research.md. Complexity: small.

## Goal

`@softure-ai/billing/scripts` exports `createGrantPlanScript(config, options?)` and
`createRevokeGrantScript(config, options?)`: ops scripts (`grant-plan --email --plan`, `revoke-grant
--email --grant`), dry run by default, `--commit` writes, that write through `grantPlanManually` and
`revokeManualGrant`, so a script grant is in the account's history and can be revoked in the admin
page, and the other way round. The example app runs them as `npm run grant-plan` / `revoke-grant`.

**Out of scope:** FU-24 and later lane C items; granting from an open request by script; listing an
account's history as its own script (the report lists active grants); any migration.

## Approach

**Starting point:** `role-scripts.ts` of auth (`defineOpsScript`, zod `strictObject` args, `before` /
`after` measured in the transaction, refusals through `refuseOpsScript`).

**Chosen:** the same shape in `modules/billing/src/scripts/plan-scripts.ts`. The report is
`{ userId, access, grants }`: `access` is `getEntitlement` (status and dates), `grants` the active
manual grants `{ id, planId, grantedAt, grant }` from `getAccountHistory`.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Dependency | `@softure-ai/ops` in billing's `dependencies` | no cycle; already installed through auth | research |
| Naming a grant | `--grant=<id>` plus `--email`; the id must be an active grant of that account | unambiguous, a wrong id refuses | research |
| Who granted | `adminId: null` | nullable column, documented for scripts | research |
| Report | user id, entitlement, active grants; never the email | `grant-role` rule | research |

## Steps

1. `modules/billing/package.json`: `./scripts` export (source, types, default) and
   `@softure-ai/ops` dependency; `npm install` refreshes the lockfile.
2. `src/scripts/plan-scripts.ts` + `src/scripts/index.ts`:
   - `grant-plan`: refuse an undeclared plan (`plan "x" is not declared (declared: …)`), an unknown
     email (`no account has this email`), lifetime access (`the account has lifetime access
     already`); otherwise `grantPlanManually({ userId, planId, adminId: null })` and report.
   - `revoke-grant`: refuse an unknown email; refuse a grant id that is not an active manual grant of
     the account (`the account has no active manual grant "<id>"`, the check reads the report's
     grants); otherwise `revokeManualGrant({ grantId, adminId: null })` (its `billing.grant_revoked`
     is the same refusal) and report.
   - An error code that cannot happen (`billing.request_closed` without a request) throws.
3. `tests/plan-scripts.test.ts` (PGlite, `executeOpsScript` / `runOpsScript`): dry run writes nothing
   and reports the change; `--commit` writes a `manual_grants` row with `granted_by` null that
   `getAccountHistory` lists and `revokeManualGrant` can revoke; email case-insensitive; refusals
   (undeclared plan, unknown email, lifetime) write nothing; revoke-grant takes back the period and
   leaves the trial; refuses another account's grant, an unknown or malformed id and a revoked grant;
   a grant made in the admin path (`grantPlanManually` with an admin id) is revoked by the script;
   the command never prints the email.
4. `examples/next-app`: `scripts/grant-plan.ts`, `scripts/revoke-grant.ts`, `package.json` scripts,
   README row; e2e in `billing-pricing.spec.ts`: the script grants a plan that the admin history
   lists, and `revoke-grant` with the id shown there takes it back.
5. `modules/billing/README.md`: §1/§4 the scripts (usage, report, refusals), §12 drops the FU-22
   limitation; package description mentions the scripts.
6. Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; e2e of billing-pricing
   locally if the example app builds here, otherwise CI.

## Progress

- [ ] 1. package export and dependency
- [ ] 2. scripts
- [ ] 3. tests
- [ ] 4. example app scripts and e2e
- [ ] 5. README
- [ ] 6. gates
