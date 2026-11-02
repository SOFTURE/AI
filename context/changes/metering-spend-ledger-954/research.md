---
change_id: metering-spend-ledger-954
status: done
---

# Research: a spend ledger and budgets (issue #954)

Read on master c9380e5: the issue, `docs/02-module-standard.md`, `templates/package/`, `modules/feature-switches`
(the smallest module with a table, privacy and health), `modules/analytics/src/jobs` (a prune job),
`modules/files/src/server/save.ts` and `modules/mcp-access/src/server/tokens.ts` (transaction-scoped advisory locks),
`foundation/llm/src/contract.ts` (`UsageRecord`), `tools/marketing-kit/src/footage/providers.ts` (`FootageCharge`),
`foundation/core` (`Result`, `ModuleContext`, calendar days and zoned instants).

## Findings

1. **Module, not a part of llm.** The ledger needs a table, migrations, a privacy contributor and a prune job, which
   are module concerns; `@softure-ai/llm` is a foundation package with no database. Its units go beyond tokens and
   dollars. So `modules/metering`, Postgres schema `metering`.
2. **The adapters need no dependency.** `llm`'s `onUsage` receives `UsageRecord` (`provider`, `model`, `costUsd`,
   `attributes`, `at`) and awaits the hook, letting a throw propagate. marketing-kit's `onCharge` is synchronous and
   receives `FootageCharge` (`step`, `item`, `provider`, `units` in seconds, optional `credits`). Both shapes can be
   read structurally, so metering depends on neither package. The synchronous hook needs a recorder that keeps the
   writes' promises and surfaces their failures when the app awaits it.
3. **Concurrency.** Two reservations must not both pass a "spent so far" check. The repository's pattern is a
   transaction with `pg_advisory_xact_lock(hashtextextended(<key>, 0))` (files, mcp-access); it works on PGlite in
   their tests. One lock per provider serialises every reservation of that provider, which covers both a provider-wide
   budget (a sum over every account) and a per-account one.
4. **Periods.** `config.timezone` is required in every app; core has `getCalendarDay`, `getDayStartInstant`,
   `addCalendarDays` and `addCalendarMonths`, which give the start and end of the current day or month in the app's
   zone, DST included.
5. **Amounts.** Credits and dollars are fractional; summing JS floats makes `0.1 + 0.2 > 0.3`. Postgres `numeric`
   compares exactly, so the budget check runs in SQL and amounts are kept as `numeric(24, 8)`.
6. **Stuck reservations.** A process that dies between reserve and settle leaves a reservation that would hold the
   budget forever. A reservation carries `expires_at`; an expired one stops counting and the prune job deletes it.
7. **Errors with data.** Core's `Err` carries only the code; the refusal must name the remaining amount, so the
   refusal is an `Err` extended with a `budget` field (still assignable to `Err`).

## Options

1. A ledger table with reservation rows (`reserved` / `settled`), budgets in options, a provider lock. Simple, one table.
2. A running-total table per provider, account and period updated by a conditional `UPDATE`. No sum per check, but
   totals drift from the ledger on settle and prune, and periods need their own rows.

Chosen: option 1. The sums are bounded by one provider's charges of one period (indexed).
