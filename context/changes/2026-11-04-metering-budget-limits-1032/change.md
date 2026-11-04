---
change_id: metering-budget-limits-1032
title: "metering: budget limits editable at runtime, stored in the database (issue #1032)"
status: in_progress
roadmap_item: null
issue: 1032
branch: claude/project-thread-ln4pyn
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1032](https://github.com/SOFTURE/AI/issues/1032). `@softure-ai/metering` 0.2.0 reads every budget's
`limit` from the module options, so an operator cannot change a provider's budget without a deploy (and the app and
worker containers must agree on the value). After this change:

1. a table `metering.budget_limits` (`provider`, `period`, `per_account`, `limit numeric(24, 8) >= 0`, `updated_at`,
   `updated_by`), primary key `(provider, period, per_account)`;
2. `setBudgetLimit(ctx, { provider, period, perAccount?, limit, updatedBy? })` stores a limit for a declared budget,
   `clearBudgetLimit(ctx, …)` returns to the configured default;
3. `reserveSpend` and `getSpend` use the stored limit when a row exists, the configured one otherwise, read inside the
   reservation's transaction after the provider lock; `BudgetExceeded.budget.limit` and `SpendSummary.limit` report
   the effective value;
4. `getBudgetLimits(ctx, { provider })` lists each declared budget with its configured default, stored value, who
   changed it and when;
5. GDPR: `updated_by` is an account id, cleared on deletion.

## Context

Labels: `enhancement`, `pkg: metering`. Files: `modules/metering/` only (migration, schema, contract, server, messages,
tests, README, CHANGELOG, manifest). Metering depends neither on auth nor on any other module that depends on it; the
module has no UI or route, so no panel guard is needed: the app authorizes its own settings form.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; product copy only in `messages/en.ts`, overridable by the app.
- The adopting app is not changed; the migration is described in the CHANGELOG and README.

## Notes

- Framing: skipped. The issue states the gap, the table, the functions and the done criteria.
