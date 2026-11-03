---
change_id: metering-spend-breakdown-994
title: "metering: spend grouped by step or by a charge attribute (issue #994)"
status: archived
archived_at: 2026-11-03
roadmap_item: null
issue: [994]
branch: claude/project-thread-i0y4b1
created: 2026-11-03
updated: 2026-11-03
---

## Intent

Close [issue #994](https://github.com/SOFTURE/AI/issues/994): charges carry `step` and `attributes`, but `getSpend`
only sums a whole provider or one account. Add `getSpendBreakdown` (rows per step or per attribute value), an
attribute `filter` on `getSpend` and on the breakdown, and an index so attribute lookups stay fast.

## Context

Labels: `enhancement`, `pkg: metering`. Package: `modules/metering` 0.1.1 on npm (manifest still 0.1.0 in source,
the release bump is the coordinator's). Checked first: nothing on master (fe3e7b5) mentions #994, no branch or pull
request for it.

## Constraints

- Same period bounds and the same "settled or unexpired reservation" rule as `getSpend`.
- Decimal sums run in SQL `numeric`, as in `getSpend`.
- Migrations move forward only and say how to roll back.
- The adopting app is not changed here; the closing comment says what it can drop.

## Notes

- Framing: skipped. The issue names the problem and three concrete asks.
