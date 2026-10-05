# Implementation review: blog-publish-slug-race

Reviewed: commit a0050f5 against plan.md (author's review, `--auto`).

## Verdict

Approve. Findings: 0 critical, 1 warning, 1 suggestion.
Evidence: gates green (typecheck, lint with the language gate, build; `npm test` with
`SOFTURE_TEST_POSTGRES_URL` on PostgreSQL 16: 3249 passed, 27 skipped). The four race tests in
`modules/blog/tests/publish-race.test.ts` failed first with the raw `DrizzleQueryError` (23505 on
`articles_slug_key`, at the insert and at the update), then passed with the mapping.

## Dimensions

Correctness (only 23505 on `articles_slug_key` is mapped; the read after the savepoint rollback),
failure paths (other driver errors rethrown, the pillar mapping unchanged), contracts (the refusal text
is the read path's text), tests (a deterministic interleaving through a blocker connection, no sleeps).

## Plan coverage

Every Goal line is implemented: `publishArticleOrRefuse` wraps each write of the run; `findDriverError`
replaces `getSqlState` for both the pillar and the slug mapping; tests cover a lost insert (the other
file of the run is not written), a lost rename (old slug kept, no history row), a lost dry run, and the
other run rolled back (the run publishes); README §12's line is gone and §5 says how a lost race is
reported. No drift.

## Findings

### W1 [WARNING] The fallback text when the winner is gone again is untested
**Where:** `publishArticleOrRefuse`, `winner === undefined`.
**Problem:** a third run renaming the winner between its commit and this read is the only path to it,
and it needs three connections in a fixed order.
**Decision:** Kept - a two-line branch with a constant text; the cost of the test outweighs the risk.

### S1 [SUGGESTION] One shared Postgres test helper for billing and blog
**Decision:** Deferred - outside lane B; both copies are small and follow the same pattern.

## Progress audit

All Progress items checked with their commit SHA.

## Triage summary

Nothing pending.
