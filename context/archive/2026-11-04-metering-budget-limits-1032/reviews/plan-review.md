---
change_id: metering-budget-limits-1032
verdict: approved
---

# Plan review: metering-budget-limits-1032

- Covers every ask of the issue: the table and its key, set / clear / list, effective limit in `reserveSpend` and
  `getSpend` (read after the lock), GDPR of `updated_by`, and both done criteria as tests.
- Concurrency: `setBudgetLimit` takes the provider's advisory lock too, so a reservation sees either the old or the new
  limit for its whole check, never a mix across budgets.
- Compatibility: without rows nothing changes; the new migration is additive. The export's shape gains a field and the
  deletion report a count: additive for an app.
- Error handling matches the module standard: operator input errors are values, programming errors throw.
- Approved without changes.
