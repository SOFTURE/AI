# Plan: jobs-oldest-running-since

## Goal
`getQueueStats` reports when each queue's longest-running job was claimed.

## Phase 1
`migrations/0011_add_claimed_at.sql`, `schema.ts` (`claimedAt`), `server/claim.ts` (`claimDue` sets it),
`server/maintenance.ts` (`oldestRunningSince`). Tests in `tests/admin.test.ts`; README, CHANGELOG, version 0.1.13.

**Done when:** jobs tests, typecheck and lint green.

## Progress
- [x] Phase 1 — jobs tests green (370/370), typecheck and lint green.
