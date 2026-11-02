---
change_id: metering-spend-ledger-954
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (c9380e5).

- Ask 1 (table): Phase 1; the issue's columns plus status and expiry for reservations.
- Ask 2 (budgets per provider and period, optionally per account): Phase 1 options, Phase 2 checks.
- Ask 3 (reserve, settle, release under a lock): Phase 2; the advisory lock is the repository's pattern and is held
  for the transaction, so two jobs cannot both pass. The check runs in `numeric`, so decimals compare exactly.
- Ask 4 (getSpend, adapters, privacy, prune): Phases 2 and 3; adapters are structural, so neither llm nor
  marketing-kit changes or becomes a dependency.
- Risk: a reservation that outlives `reservationTtlSeconds` stops holding the budget, and a settle after it was
  pruned fails with `reservation_not_found`. Documented; the default TTL is an hour and the prune job runs daily.
- Risk: a single lock per provider serialises reservations of a busy provider. The critical section is two indexed
  sums and an insert; accepted.
- The plan's change to `status` in plan.md and change.md follows the chain.

Verdict: approved, no changes.
