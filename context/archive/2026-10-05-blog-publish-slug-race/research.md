# Research: blog-publish-slug-race

Sources: `modules/blog/src/db/articles.ts` (`publishArticle`), `modules/blog/src/db/publish-run.ts`
(`runBlogPublish`, `getSqlState`), `modules/blog/migrations/0001_create_articles.sql`, the blog README §12,
`modules/billing/tests/postgres.ts` and `lock-races.test.ts` (the repository's two-connection test pattern),
`.github/workflows/ci.yml` (the `postgres:16` service and `SOFTURE_TEST_POSTGRES_URL`).

## Summary

`articles_slug_key` is an immediate (not deferrable) unique constraint, so a lost race never surfaces at
commit: it surfaces at the run's own `INSERT` (a new article) or `UPDATE` (a renamed article). Postgres makes
the second writer wait on the first writer's uncommitted index entry; when the first commits, the second
fails with 23505 on `articles_slug_key`; when the first rolls back, the second succeeds. `publishArticle`
runs as a savepoint inside the run's transaction, and drizzle rolls the savepoint back before rethrowing,
so the outer transaction can still read. At read committed, a fresh read sees the winner's committed row
and can name it.

## Findings

1. **Where the error surfaces:** reproduced on PostgreSQL 16 with a blocker connection that inserts the
   slug in an open transaction; the run under test reads the slug as free, writes, waits
   (`pg_stat_activity.wait_event_type = 'Lock'`), and fails after the blocker commits:
   `DrizzleQueryError` whose `cause` is pg's `DatabaseError` with `code: '23505'`,
   `constraint: 'articles_slug_key'`. The same for the `UPDATE` of a rename. Nothing at commit.
2. **What to match:** the code and the constraint name, read through the `cause` chain like the existing
   `getSqlState` does for the pillar rule (23P01). Other unique violations (none expected: `slug_history`'s
   key is an old slug that was itself unique) keep propagating as bugs.
3. **Naming the winner:** after the savepoint rollback, `SELECT id FROM articles WHERE slug = $1` on the
   transaction returns the winner. If it is gone again (renamed in a third run), the message says
   "another article published at the same time".
4. **Test harness:** PGlite has one connection and cannot race. Billing's `tests/postgres.ts` pattern
   (own database per test on `SOFTURE_TEST_POSTGRES_URL`, a blocker connection, `waitForLockWaiters`,
   a skip locally and a required run in CI) fits as is; blog gets its own copy, as foundation/db and
   billing each keep theirs.

## Gap found (not fixed here)

- A run that gives article Y the slug `s` that article X is renaming away from in another, uncommitted run
  waits on X's old index entry; when X commits, Y's insert succeeds, and `s` is then both Y's current slug
  and an old slug of X in `slug_history`. Inferred from Postgres's unique-index semantics, not reproduced.
  Recorded as **BF-12** (`blog-slug-history-race`) in the roadmap.
