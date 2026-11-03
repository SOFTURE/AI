---
change_id: metering-spend-breakdown-994
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (fe3e7b5).

- Ask 1 (`getSpendBreakdown`): Phase 1, the issue's signature, rows in the provider's unit, the same bounds and
  status rule as `getSpend` because both share one query builder.
- Ask 2 (`filter` on `getSpend`): Phase 1; budget fields keep the scope's budget, which is right: a filter narrows
  the reading, not the limit.
- Ask 3 (index): Phase 1, GIN `jsonb_path_ops` and containment; a test checks the plan uses it, so a later rewrite to
  `->>` would be caught.
- Null keys: the plan keeps them as a row, so a page can show "unassigned" spend and totals reconcile. Good.
- Risk: building a GIN index on a large existing table locks writes for the build. The table is new (0.1.x, one
  adopting app) and small; accepted, noted in the changelog.

Verdict: approved, no changes.
