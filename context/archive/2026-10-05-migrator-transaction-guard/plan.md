# Plan: migrator-transaction-guard

Input: change.md. Complexity: small (one phase).

## Phase 1: Transaction id as the marker

**Discipline:** TDD.
1. Test: the same transaction-ending file applied 50 times on each driver; every attempt reports a
   problem and the ledger stays untouched.
2. `readTransactionId` with `pg_current_xact_id()` replaces `readTransactionStart`.
3. Gates: typecheck, lint, test.

## Progress

- [x] Phase 1: transaction id as the marker (commit in this change's merge)
