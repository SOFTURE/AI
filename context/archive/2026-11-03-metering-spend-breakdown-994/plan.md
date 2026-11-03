---
change_id: metering-spend-breakdown-994
status: archived
---

# Plan: spend grouped by step or by a charge attribute (issue #994)

Input: change.md, research.md (option 1). Complexity: small (one package).

## Phase 1: breakdown, filter and index (TDD)

Files: `modules/metering/src/server/spend.ts`, `src/server/index.ts`, `src/contract.ts`, `src/index.ts`,
`migrations/0002_index_charge_attributes.sql`, `tests/spend.test.ts`.

- `SpendFilter = { attribute: string; value: string }`; attribute 1 to 100 characters, value 1 to 500. Invalid input
  throws (a bug), like the other asserts.
- `getSpend(ctx, { provider, period, accountId?, filter? })`: `filter` adds
  `attributes @> jsonb_build_object(attribute, value)`; the budget fields stay those of the scope (a filter does not
  change which budget applies).
- `getSpendBreakdown(ctx, { provider, period, accountId?, groupBy: "step" | { attribute }, filter? })` returns
  `ok(SpendBreakdown)`: `provider`, `unit`, `period`, `accountId`, `groupBy`, `from`, `resetsAt`, `rows`.
  A row is `{ key: string | null, settled, reserved, spent }`; `key: null` gathers charges without the step or the
  attribute, so rows add up to `getSpend`. Rows ordered by `spent` descending, then `key` ascending, nulls last.
- Migration 0002: `CREATE INDEX charges_attributes_idx ON charges USING gin (attributes jsonb_path_ops)`, with the
  rollback line.
- Tests: grouping by step with a null row; grouping by an attribute; filter on getSpend and on the breakdown; expired
  reservations and other periods excluded; the rows add up to getSpend; invalid attribute throws; the index exists and
  the plan uses it for a filter when sequential scans are off.

## Phase 2: docs

README (API table, a "Spend per item" section, the index), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Filter through `@>` so the GIN index serves it; `->>` would need one expression index per attribute key the app
  might use.
- No `limit` on breakdown rows: one provider and one period bound the result; an app that needs one item's figures
  uses `filter`.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: breakdown, filter and index (28a1365)
- [x] Phase 2: docs (18adc1e)
- [x] Implementation review
