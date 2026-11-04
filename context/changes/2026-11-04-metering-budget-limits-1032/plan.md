---
change_id: metering-budget-limits-1032
status: done
---

# Plan: runtime budget limits (issue #1032)

Input: change.md, research.md (option 1). Complexity: medium.

## Phase 1: table and limit functions (TDD)

Files: `migrations/0003_create_budget_limits.sql`, `src/schema.ts`, `src/contract.ts`, `src/messages/en.ts`,
`src/server/limits.ts`, `src/server/index.ts`, `src/index.ts`, `src/server/health.ts`, manifest (`src/index.ts`,
`module.json`), `tests/limits.test.ts`, `tests/module.test.ts`.

- Migration: `budget_limits (provider text, period text in ('day','month'), per_account boolean, "limit"
  numeric(24, 8) >= 0, updated_at timestamptz, updated_by text 1..200 nullable)`, primary key
  `(provider, period, per_account)`, index on `updated_by` where not null; rollback note.
- `setBudgetLimit` (under the provider lock, upsert), `clearBudgetLimit` (delete, `ok({ cleared })`),
  `getBudgetLimits` (declared budgets with `configuredLimit`, `storedLimit`, `limit`, `updatedAt`, `updatedBy`).
- `metering.invalid_budget_limit` error code and English copy.
- Health check probes both tables.
- Tests: set, list, clear; invalid limit returned; undeclared budget throws; table constraints.

## Phase 2: effective limits in spend

Files: `src/server/spend.ts`, `tests/limits.test.ts`.

- `reserveSpend`: after the lock, read the provider's stored limits once; each budget check uses the stored limit or
  the configured one; `BudgetExceeded.budget.limit` is the effective value.
- `getSpend`: reads the stored limit of its budget.
- Tests: the issue's done criteria (reserve against config, lower stored limit refuses with the stored value, clear
  restores; `getSpend` reports stored limit and remaining), a stored `0` stops the provider, per-account override.

## Phase 3: privacy and docs

Files: `src/server/privacy.ts`, `tests/privacy.test.ts`, README, CHANGELOG.

- Export lists the budget limits the user last changed; deletion clears `updated_by` and reports the count.
- README: runtime limits section, functions table, migration and table, GDPR. CHANGELOG `## Unreleased`.

## Decisions (auto)

- Option 1 (override table) as proposed in the issue.
- A stored limit may be 0; the configured one stays positive.
- Invalid limit is a returned error; an undeclared budget throws.
- No auth dependency: the module has no route; the app authorizes the operator.

## Progress

- [x] Phase 1: table and limit functions (9cff05b)
- [x] Phase 2: effective limits in spend (9cff05b)
- [x] Phase 3: privacy and docs (9cff05b)

The three phases landed in one commit: the spend change and its tests depend on the table of phase 1, and the export
test on both.
