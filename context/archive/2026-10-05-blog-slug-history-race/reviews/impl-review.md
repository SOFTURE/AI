# Implementation review: blog-slug-history-race

Reviewed: the phase 1 commit against plan.md @ 2026-10-05. Verdict: done.
Findings: 0 critical, 0 warnings, 2 notes. No gaps.

## Plan conformance

| Plan item | Delivered |
| --- | --- |
| 1 tests | `modules/blog/tests/publish-race.test.ts`, block "a publish run that takes a slug another run is renaming away from": a blocker renames article x from `index-funds` to `index-funds-guide` and writes the history row; a new article y and an article y renamed from `bonds` are refused at once with `blog.slug_taken` naming x while it is open; after the commit `index-funds` has no article and the history is `[index-funds → x]`; a new y after the commit is refused with `blog.slug_in_history` naming x |
| 2 comment | `modules/blog/src/db/articles.ts` (`publishArticle`): above the two reads, why current slugs are read before old ones (BF-12) |
| 3 README | `modules/blog/README.md` §5: the check reads current slugs before old ones, so a slug another run is leaving is refused, committed or not |

## Checks

- The three new tests pass on PostgreSQL 16 (`SOFTURE_TEST_POSTGRES_URL`); BF-2's four race tests pass
  unchanged. The open-rename tests await the run before the blocker commits, so a lock wait would fail
  them by timeout rather than pass.
- Gates green (typecheck, lint, test with the Postgres URL set, build).
- Diff scanned for non-English text outside message dictionaries: none.

## Notes

- R1 (accepted): no code path changes; BF-2's gap does not occur (research finding 1). The roadmap item's
  outcome, "the run is refused and a two-connection Postgres test covers it", holds with the tests.
- R2 (accepted): a swap of the two reads is guarded by the comment only, as the plan review (W1) says no
  test can force X's commit between Y's two statements.
