# Changelog

Newest first. Each version lists what changed for an app that uses the module. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- Budget limits editable at runtime, stored in the database (#1032): `setBudgetLimit(ctx, { provider, period,
  perAccount?, limit, updatedBy? })` overrides a declared budget's configured limit (`0` stops the provider),
  `clearBudgetLimit` returns to it, and `getBudgetLimits(ctx, { provider })` lists each declared budget with its
  configured default, stored value, who changed it and when, for an app's own settings form. `reserveSpend` and
  `getSpend` use the stored limit when there is one; `BudgetExceeded.budget.limit` and `SpendSummary.limit` report
  the limit in force. Invalid input returns the new error code `metering.invalid_budget_limit` (English copy in
  `messages`; an app with its own dictionary adds the key).
- Migration `0003_create_budget_limits.sql`: table `metering.budget_limits`. Run `softure migrate` before the app and
  the worker start on this version (the reservation reads the table). Without rows nothing changes. An app that read a
  limit from an environment variable to change it by redeploy can keep the variable as the configured default and move
  the operator's changes to `setBudgetLimit`.
- GDPR: `exportMeteringUserData` adds `budgetLimits` (the limits the user last set), `deleteMeteringUserData` clears
  `updated_by` and reports `anonymizedBudgetLimits`.
- The health check also probes `metering.budget_limits`.

## 0.2.0

- `getSpendBreakdown(ctx, { provider, period, accountId?, groupBy: "step" | { attribute }, filter? })` (#994): the
  period's spend per step or per attribute value, as rows `{ key, settled, reserved, spent }`; charges without the
  step or attribute form the `key: null` row, so the rows add up to `getSpend`.
- `getSpend` takes an optional `filter: { attribute, value }` for one item's spend; `limit` and `remaining` stay the
  scope's budget.
- Migration `0002_index_charge_attributes.sql`: a GIN (`jsonb_path_ops`) index on `attributes`, so a filter is an
  index lookup. Run `softure migrate`; the build briefly blocks writes to `metering.charges`, which is small at this
  stage. An app that summed spend per item from `exportMeteringUserData` or its own query on the table can switch to
  these.

## 0.1.1

- No changes for an app: the first release published through the npm trusted publisher (OIDC) instead of a token.

## 0.1.0

- First version (#954): the `metering.charges` ledger, budgets per provider and day or month (optionally per account),
  `reserveSpend` / `settleSpend` / `releaseSpend` under a provider lock, `recordCharge`, `getSpend`, adapters for
  `@softure-ai/llm`'s `onUsage` and marketing-kit's `onCharge`, a privacy contributor and the
  `metering.prune-charges` job.
