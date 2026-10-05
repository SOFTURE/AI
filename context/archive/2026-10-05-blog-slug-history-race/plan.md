# Plan: blog-slug-history-race

Input: change.md, research.md. Complexity: small (one phase).

## Goal

- Two-connection Postgres tests show that a run giving Y the slug `s` that X is leaving in another run is
  refused naming X, both while X's rename is open (`blog.slug_taken`) and once it is committed
  (`blog.slug_in_history`), and that afterwards `s` is only X's old slug.
- `publishArticle` says why it reads the current slugs before the old ones.
- The blog README's schema paragraph says the same in one sentence.

**Out of scope:** a database trigger or constraint across `articles` and `slug_history` (research finding
5); any change to the run's messages or result shape.

## Approach

**Starting point:** `publishArticle` (`modules/blog/src/db/articles.ts`) reads `articles` by slug, then
`slug_history` by old slug, both unlocked; the reproduction (research finding 1) shows the run is refused.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Fix or pin | pin (comment + tests) | the race is not reproducible; the order of the two reads is what prevents it | research 1, 4 |
| One statement for both reads | no | a `UNION ALL` gives one snapshot, but the two reads already cover every commit point; it would change working code for no observed case | research 4 |
| X's rename in the test | raw SQL on a blocker connection (`UPDATE` + history `INSERT`), as BF-2's `holdSlug` | `publishArticle` runs inside a callback and cannot be held open | BF-2 |

## Phase 1: Pin the read order of the slug check

**Discipline:** test-after (the behaviour is already right; the tests pin it). **Files:**
`modules/blog/tests/publish-race.test.ts`, `modules/blog/src/db/articles.ts`, `modules/blog/README.md`.

1. `publish-race.test.ts`, new block "a run that takes a slug another run is renaming away from":
   a helper that publishes X at `index-funds`, then on a blocker renames it to `index-funds-guide` and
   writes the history row, left open.
   - new article Y at `index-funds` while open: the run resolves before the blocker commits, refused with
     "slug index-funds is the slug of article x (blog.slug_taken)"; after the commit, no article at
     `index-funds`, history `[index-funds → x]`.
   - existing article Y renamed to `index-funds` while open: the same refusal; Y keeps its slug; history
     after the commit only names X.
   - new article Y after the blocker commits: refused with "slug index-funds redirects to article x
     (blog.slug_in_history)".
2. `articles.ts`: a comment above the two reads: a rename writes both tables at once, so reading the
   current slugs first means a run sees either X still at the slug or X's old slug; the reverse order
   could miss both (BF-12).
3. README: the "stays in the code" sentence adds that the check reads current slugs before old ones, so a
   slug another run is leaving is refused, naming that article.

**Tests:** the three race tests above against the local Postgres (`SOFTURE_TEST_POSTGRES_URL`); they skip
without it and are required in CI like BF-2's.

**Done when:**
- Automated: the three tests pass on PostgreSQL 16; gates green (typecheck, lint, test, build).

## Risks and rollback

- A later refactor swaps the reads → the comment names the order as load-bearing and cites BF-12. No test
  can catch a swap: it needs X to commit between Y's two statements, and nothing in `publishArticle` pauses
  there (plan review W1).
- Rollback: revert the phase commit. Nothing persistent changes.

## Decisions (auto)

- Assert "no lock wait" by awaiting the run before releasing the blocker: a wait would hang until the test
  timeout and fail it.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Pin the read order of the slug check

#### Automated
- [x] 1.1 Race tests: rename open (new and renamed Y) and rename committed, refused naming X — accbc6f
- [x] 1.2 Comment in `publishArticle` and the README sentence on the read order — accbc6f
- [x] 1.3 Gates green (typecheck, lint, test, build) — accbc6f
