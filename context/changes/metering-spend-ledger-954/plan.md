---
change_id: metering-spend-ledger-954
status: plan_reviewed
---

# Plan: `@softure-ai/metering` 0.1.0 (issue #954)

Input: change.md, research.md (option 1). Complexity: medium (one new package).

## Phase 1: package, table, options (TDD)

Files: `modules/metering/` (copied from `templates/package/`: package.json, module.json, tsconfig, CHANGELOG,
messages), `migrations/0001_create_charges.sql`, `src/{index,contract,options,schema}.ts`, `src/server/health.ts`,
`tests/{support,module}.test.ts`, `package-lock.json`.

- `metering({ providers: [{ id, unit, budgets: [{ period: "day" | "month", limit, perAccount? }] }], reservationTtlSeconds })`.
  Units: `credits`, `usd`, `characters`, `seconds`, `tokens`, `requests`. A provider declared twice, or two budgets
  of the same period and scope, are refused at startup.
- `metering.charges`: id, provider, step, unit, amount `numeric(24, 8) >= 0`, account_id, attributes (jsonb object),
  status `reserved | settled`, created_at, expires_at (set exactly while reserved), settled_at. Checks on every column.
- Tests: manifest equals module.json, defaults, refusals, table constraints.

## Phase 2: reserve, settle, release, record, read (TDD)

Files: `src/server/{periods,spend,options,index}.ts`, `tests/spend.test.ts`.

- `reserveSpend(ctx, { provider, amount, step?, accountId?, attributes? })`: in one transaction, under the provider's
  advisory lock, sums settled and unexpired reserved charges of each applying budget's current period in SQL
  `numeric`; refuses with `metering.budget_exceeded` and `budget: { provider, unit, period, scope, limit, spent,
  remaining, resetsAt }`, else inserts a reservation. A per-account budget without `accountId` is a bug (throws).
- `settleSpend(ctx, reservation, actual)`, `releaseSpend(ctx, reservation)`: `metering.reservation_not_found` when it
  is already settled, released or pruned.
- `recordCharge(ctx, { provider, amount, ... })`: a settled charge with no reservation (after the fact).
- `getSpend(ctx, { provider, period, accountId? })`: settled, reserved, spent, limit, remaining, from, resetsAt.
- An undeclared provider or a negative or non-finite amount throws (a bug, not an expected failure).
- Tests: refusal with the exact remaining, exact decimals (0.1 + 0.2 under a 0.3 limit), per-account and provider-wide
  budgets together, a reservation that expires stops counting, period edges in the app's zone (day and month), two
  reservations started together on one handle where only one fits.

## Phase 3: adapters, privacy, prune job, docs

Files: `src/server/{adapters,privacy,prune}.ts`, `src/jobs/index.ts`, `tests/{adapters,privacy,jobs}.test.ts`,
`README.md` (twelve sections), `CHANGELOG.md`, root `README.md`.

- `recordLlmUsage(ctx, record, { provider?, step? })` and `createLlmUsageRecorder(ctx, options)` for `onUsage`: a usd
  charge of `costUsd` (nothing when it is `null`), `accountId` from the record's attributes.
- `createFootageChargeRecorder(ctx, { provider?, creditsPerSecond? })`: `onCharge` (synchronous) and `flush()`, which
  awaits every write and rejects with the first failure. Seconds or credits by the provider's unit.
- Privacy: export the charges whose `account_id` is the user; deletion clears `account_id` and `attributes` and keeps
  the amounts, so the totals stay true.
- `pruneCharges(ctx, { keepDays })` (at least 32, so a month budget never loses its own period) and expired
  reservations; `meteringJobHandlers`, `createMeteringJobSchedules({ keepDays })` (daily).

## Decisions (auto)

- A module, not a part of `llm` (research 1); no dependency on llm or marketing-kit (research 2).
- One advisory lock per provider rather than per budget: simpler, and correct for overlapping scopes.
- Spend counts at reservation time and stays in the reservation's period when settled later.
- A settle above the reserved amount is recorded as is: the ledger records what was billed, even past a budget.
- Deletion anonymises charges instead of deleting them: spend totals are the app's records, not the user's.
- No `next/` or `ui/` entry: `getSpend` serves the app's own status tool or page.

## Progress

- [ ] Phase 1: package, table, options
- [ ] Phase 2: reserve, settle, release, record, read
- [ ] Phase 3: adapters, privacy, prune job, docs
- [ ] Implementation review
