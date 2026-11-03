---
change_id: metering-spend-breakdown-994
---

# Research

## Findings

1. `src/server/spend.ts`: `getSpend` resolves the provider, the period bounds (`getPeriodBounds`) and calls
   `sumSpend`, which filters `provider`, `created_at` in `[from, resetsAt)`, `status = 'settled' or expires_at > now`
   and optionally `account_id`, and sums `amount` per status in `numeric`. A breakdown is the same filter with a
   `group by`.
2. `attributes` is `jsonb NOT NULL DEFAULT '{}'`, always an object of strings (the API types it
   `Record<string, string>`). `step` is nullable text, 1 to 100 characters.
3. Indexes today (migration 0001): `(provider, created_at)`, `account_id` (partial), `expires_at` (partial). Nothing
   on `attributes`. A per-item total (`attributes @> '{"jobId":"j1"}'`) scans every charge of the provider in the
   period.
4. Postgres: a GIN index with `jsonb_path_ops` serves the containment operator `@>` and is smaller than the default
   `jsonb_ops`; it does not serve `->>` equality. So the filter is written as
   `attributes @> jsonb_build_object(key, value)`, which is equivalent for string values. PGlite (tests) supports
   GIN and `jsonb_path_ops`.
5. Grouping by `attributes ->> key` needs no index of its own: the rows are already narrowed by
   `(provider, created_at)` to one period, and a month of one provider is the expected scale.
6. Charges without a step, or without the grouped attribute, still count in the period total; they belong in a row
   with `key: null` so the rows add up to `getSpend`.

## Options

1. A new `getSpendBreakdown` plus `filter` on `getSpend`, sharing one query builder; GIN index in migration 0002.
   Rows add up to the period total.
2. Only a generic `listCharges` read and let the app aggregate. More data over the wire, sums in floating point.

Recommended: option 1 (what the issue proposes, exact sums, one query).
