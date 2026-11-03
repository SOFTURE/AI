---
change_id: metering-spend-breakdown-994
verdict: approved
---

# Implementation review

Reviewed the diff of 28a1365 and 18adc1e against plan.md.

- Ask 1: `getSpendBreakdown` groups with the same conditions as `getSpend` (one `getSpendConditions` builder), sums in
  `numeric`, orders by spend then key with nulls last. Tests: per step, per attribute, sum equals `getSpend`, ties,
  expired reservations, empty period, account and filter scopes.
- Ask 2: `filter` on `getSpend` narrows the sums only; the budget lookup is unchanged, tested with a provider budget.
- Ask 3: migration 0002 adds the GIN `jsonb_path_ops` index; the filter is written as containment and a test checks
  the planner picks `charges_attributes_idx`.
- Safety: the attribute name and value travel as bind parameters (`jsonb_build_object($1::text, $2::text)`,
  `attributes ->> $1`), tested with quotes in both. Invalid names and values throw with the operation named.
- Budget checks (`readBudgetState`) pass no filter, so reservations behave as before; the existing ledger tests pass
  unchanged.
- Gates: metering suite 56 tests green, typecheck and ESLint clean, language gate clean.

Verdict: approved, no changes.
