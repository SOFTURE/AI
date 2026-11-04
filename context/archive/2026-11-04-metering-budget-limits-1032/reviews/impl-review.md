---
change_id: metering-budget-limits-1032
verdict: approved
---

# Implementation review: metering-budget-limits-1032

- Every ask of #1032 is in place: `metering.budget_limits` (migration 0003, primary key `(provider, period,
  per_account)`, `limit >= 0`), `setBudgetLimit`, `clearBudgetLimit`, `getBudgetLimits`, effective limits in
  `reserveSpend` and `getSpend`, `updated_by` exported and cleared on deletion.
- Both done criteria are tests in `tests/limits.test.ts`: a reservation against the configured limit, a lower stored
  limit refusing the next one with `budget.limit` = stored value, clearing restoring the configured one; `getSpend`
  reporting the stored limit and its `remaining`.
- Concurrency: the stored limits are read inside the reservation's transaction after `lockProviderBudgets`; set and
  clear take the same lock. The lock helper is shared, so both use one key.
- Error handling: operator input returns `metering.invalid_budget_limit` (with English copy); an undeclared budget,
  provider or an empty `updatedBy` throws with the operation and input named.
- Without rows the behaviour is unchanged (all 0.2.0 tests pass untouched, except the export and deletion report,
  which gained additive fields).
- No dependency on auth in either direction; the module still has no route, the README says the app authorizes.
- Gates: typecheck, ESLint, language gate, metering tests (71) and repository tests green.
