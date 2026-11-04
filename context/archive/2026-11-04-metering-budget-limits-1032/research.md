---
change_id: metering-budget-limits-1032
status: done
---

# Research: runtime budget limits (issue #1032)

## Current state

- `src/options.ts`: a budget is `{ period, limit > 0, perAccount }`, at most one per period and scope per provider.
- `src/server/spend.ts`: `reserveSpend` takes `pg_advisory_xact_lock(hashtextextended('metering:<provider>', 0))`
  inside one transaction, then `readBudgetState` per applying budget sums the period and compares
  `spent + adding > limit` in SQL `numeric`. `getSpend` picks the budget of the query's period and scope and passes
  its `limit` to `sumSpend`.
- Limits are only in the parsed config; nothing is stored.
- Privacy contributor anonymises `charges.account_id`; health check probes `metering.charges`.
- Dependencies: core, db, optional peer jobs. No auth dependency in either direction.

## Options

1. **A table of overrides keyed by the budget's identity** `(provider, period, per_account)`, read under the provider
   lock in `reserveSpend`, and directly in `getSpend`. A row overrides the configured limit; no row means the config.
   Writes take the same provider lock, so a change and a reservation serialize.
2. Store every budget in the database and treat the config as a seed. Rejected: a migration of state, a sync step at
   start-up, and two sources of truth for the declared set.

Option 1 is the issue's proposal and the smallest change: the config still declares which budgets exist (period and
scope), the table only overrides the number.

## Details

- A stored limit may be `0` (stop the provider) though a configured one must be positive: an operator switching a
  provider off is a real need; config keeps `> 0` unchanged.
- A row of a budget the config no longer declares is ignored (and not listed); it costs nothing and returns if the
  budget is declared again.
- The reservation reads the provider's rows in one query after the lock: one extra indexed read (primary key prefix).
- An invalid limit from an operator's form (negative, not finite, above `1e15`) is an expected failure: returned as
  `metering.invalid_budget_limit`. An undeclared budget or provider is a bug (the form is built from
  `getBudgetLimits`): it throws, as elsewhere in the module.
