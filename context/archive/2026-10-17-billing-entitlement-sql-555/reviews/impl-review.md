---
change_id: billing-entitlement-sql-555
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: billing-entitlement-sql-555

Reviewed: the branch diff against plan.md, change.md and issue #555.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The property test compares status, end, read-only start and reason with `getEntitlement` under four policies (Warsaw, `trial.startsAt` in New York, Santiago where midnight is skipped, a zero-day trial in Kiritimati), at random instants and at every end and the millisecond before it; two mutations of the migration fail it. | No change. |
| 2 | Check | `entitlement_state` is inlined: `EXPLAIN` shows two primary-key index scans, no scan of every account. | No change. |
| 3 | Check | `/testing` is not imported by runtime code; the upsert keeps `updated_at >= created_at` (tested with an earlier `now`). | No change. |
| 4 | Minor | The README example called accounts with `paid_until is null` "never paid"; a revoked or fully refunded account also has none. | Reworded to "no paid access on record". |
| 5 | Minor | `days_left` and `is_ending` are not in SQL. | Accepted: display concerns tied to the reminder options; the issue asks for kind, end and lifetime. Documented. |
