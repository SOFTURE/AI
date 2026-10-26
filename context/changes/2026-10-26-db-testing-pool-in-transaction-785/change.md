---
change_id: db-testing-pool-in-transaction-785
title: "db/testing: fail fast on a pool query inside a transaction of the single-connection test database (issue #785)"
status: open
roadmap_item: null
issue: 785
branch: claude/project-thread-fo2sjr
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #785](https://github.com/SOFTURE/AI/issues/785): a test whose code queries the test database's pool
(`ctx.db`) from inside a transaction of the same database (e.g. a `processSyncItem` callback that reads a credential
through `requestWithConnection` built from the job's context) fails at once with an error naming the cause, instead
of hanging until the test timeout. The jobs README states the rule (every database access inside `run` goes through
the callback's `db`) with a provider-call example and its refresh-rollback consequence; the connections README says
the same for `requestWithConnection` inside a transaction.

## Context

- Labels: none yet. Found while adopting jobs and connections in an adopting app.
- PGlite has one connection: `client.query` outside a transaction waits on the transaction mutex the open
  transaction holds, so it never returns while the transaction waits for it.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- Production behaviour unchanged: the guard lives only in `@softure-ai/db/testing`.
- Legit concurrency keeps working: a pool query from unrelated async work (not started inside the transaction
  callback) still waits for the transaction, as PGlite serializes it.
- Merges after #783 (PR #791), which also changes jobs, with a fresh master merged in.

## Notes

- Framing: skipped. The issue names the outcome and three acceptable fixes.
