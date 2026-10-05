# Plan: blog-publish-slug-race

Input: change.md, research.md. Complexity: small (1 phase). Risk: low (an error mapped to a refusal; no
schema change).

## Goal

- `runBlogPublish` turns a unique violation on `articles_slug_key` (23505), at the insert or the update of
  any article in the run, into `{ status: "refused" }` with one problem: subject the article id, message
  `slug <slug> is the slug of article <winner> (blog.slug_taken)`, the same text as a slug found taken by
  the read. The whole run is rolled back (all or nothing, unchanged).
- Any other driver error still propagates.
- Tests on a real Postgres (two connections): insert lost, rename lost (old slug and empty history kept),
  dry run lost, the other run rolled back (the run publishes). Skipped locally without
  `SOFTURE_TEST_POSTGRES_URL`, required in CI.
- Blog README §12: the limitation line is removed.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where to catch | around each `publishArticle` call in the run, inside the transaction | knows the input (slug, id) and can still read after the savepoint rollback | research 1, 3 |
| What to match | SQLSTATE 23505 **and** constraint `articles_slug_key` | other unique violations are bugs and must stay loud | research 2 |
| The winner's name | re-read the slug owner in the transaction; fallback text when none | same message as the read path; read committed sees the winner | research 3 |
| Driver error helper | `getSqlState` becomes `findDriverError` (code and constraint) | one walk of the `cause` chain for both mappings | research 2 |
| Test harness | copy billing's `tests/postgres.ts` into blog's tests | the repository keeps one per package; no shared test package exists | research 4 |

Rejected: `SELECT … FOR UPDATE` or an advisory lock on the slug before the write (serialises publishes for
a case the database already refuses; the outcome only asks for the message); retrying the run (the second
run would be refused by the read anyway).

## Phase 1: Map the lost race

**Discipline:** TDD (the race tests fail first with the raw driver error).

- `modules/blog/tests/postgres.ts`, `modules/blog/tests/publish-race.test.ts`.
- `modules/blog/src/db/publish-run.ts`: `publishArticleOrRefuse`, `findSlugOwner`, `findDriverError`.
- `modules/blog/README.md` §12.

## Risks and rollback

No migration. Rollback: revert the commit; a lost race fails with the driver error again.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Map the lost race

#### Automated
- [x] 1.1 Race tests in `modules/blog/tests/publish-race.test.ts` pass on PostgreSQL 16 — a0050f5
- [x] 1.2 Gates green (typecheck, lint, test, build) — a0050f5

#### Manual
- [x] 1.3 Impl review recorded in `reviews/impl-review.md` — a0050f5
