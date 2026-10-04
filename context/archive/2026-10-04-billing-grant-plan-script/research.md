# Research: billing-grant-plan-script

Input: change.md. Sources: `modules/auth/src/scripts/role-scripts.ts`, `modules/auth/tests/role-scripts.test.ts`,
`modules/ops/src/scripts/ops-script.ts`, `modules/billing/src/server/{grants,plans,entitlements}.ts`,
`modules/billing/README.md` §4, §12, `examples/next-app/scripts/grant-role.ts`,
`examples/next-app/e2e/{auth-roles,billing-pricing}.spec.ts`, `foundation/db/src/client.ts`.

## Answers to unknowns

**May billing depend on `@softure-ai/ops`?** Yes. `@softure-ai/ops` depends only on `core` and
`db` (`modules/ops/package.json`), so it cannot form a cycle with billing. Billing already depends
on `@softure-ai/auth`, which depends on `@softure-ai/ops` for `grant-role`, so every app with
billing installs ops today. The build (`scripts/build-workspaces.mjs`) orders packages by their
dependencies; adding `@softure-ai/ops` to billing's `dependencies` builds ops first.

**How does the script name a grant to revoke?** By its id, together with the account's email:
`revoke-grant --email=… --grant=<id>`. The id is the one the admin page's history uses
(`manual_grants.id`), and the scripts print it: the `before`/`after` report of both scripts lists
the account's active manual grants with their ids, so `grant-plan` prints the new grant's id and a
dry run of `revoke-grant` with any id shows the ids there are. Requiring the email as well makes a
mistyped or pasted id of another account a refusal rather than a revoke of someone else's access.
Rejected: "the latest active grant of a plan" (`--plan=monthly`): ambiguous when an account holds
two grants of one plan, and it silently picks one, which an ops script must not do (FIRE_TRACKER's
rule, `ops-script.ts`: two matching rows are a refusal).

## Transactions

`executeOpsScript` runs `run(tx, args)` inside `db.transaction`. `grantPlanManually` and
`revokeManualGrant` open their own `ctx.db.transaction(...)`; with `ctx.db = tx` drizzle runs that
as a savepoint inside the script's transaction (`Queryable` is a database or a transaction, both
with `transaction`). Their locks (account key share, `lockEntitlementRow`, then the grant row) are
taken in the outer transaction and held until it commits or the dry run rolls back, so `before`,
the change and `after` are read under them. A refusal from either function writes nothing; the
script then returns `refuseOpsScript`, which rolls the outer transaction back too.

## What the scripts reuse

- `findAccountByEmail(ctx, email)` (trims and lowercases, as auth stores emails).
- `getBillingPlans(config)` for the declared plan ids; `grantPlanManually` refuses an unknown plan
  itself, but the script names the declared ones (as `grant-role` names declared roles).
- `getEntitlement(ctx, userId)` for where the account stands (a read, no side effects).
- `getAccountHistory(ctx, userId)` for the active manual grants (newest first, up to 100).
- `adminId: null`: `manual_grants.granted_by` / `revoked_by` are nullable and the history does not
  show them; `GrantPlanManuallyInput.adminId` documents null as "a script".

## Privacy

Like `grant-role`, reports carry the user id, never the email (the operator typed it; logs of ops
runs should not collect it).
