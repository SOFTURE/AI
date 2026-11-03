# Changelog

Newest first. Each version lists what changed for an app that uses the module. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- `getSpendBreakdown(ctx, { provider, period, accountId?, groupBy: "step" | { attribute }, filter? })` (#994): the
  period's spend per step or per attribute value, as rows `{ key, settled, reserved, spent }`; charges without the
  step or attribute form the `key: null` row, so the rows add up to `getSpend`.
- `getSpend` takes an optional `filter: { attribute, value }` for one item's spend; `limit` and `remaining` stay the
  scope's budget.
- Migration `0002_index_charge_attributes.sql`: a GIN (`jsonb_path_ops`) index on `attributes`, so a filter is an
  index lookup. Run `softure migrate`; the build briefly blocks writes to `metering.charges`, which is small at this
  stage. An app that summed spend per item from `exportMeteringUserData` or its own query on the table can switch to
  these.

## 0.1.0

- First version (#954): the `metering.charges` ledger, budgets per provider and day or month (optionally per account),
  `reserveSpend` / `settleSpend` / `releaseSpend` under a provider lock, `recordCharge`, `getSpend`, adapters for
  `@softure-ai/llm`'s `onUsage` and marketing-kit's `onCharge`, a privacy contributor and the
  `metering.prune-charges` job.
