# Plan review: blog-slug-history-race

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready.
Findings: 0 critical, 1 warning (fixed in the plan), 1 suggestion.
Grounding: 3/3 paths (`modules/blog/src/db/articles.ts`, `modules/blog/tests/publish-race.test.ts`,
`modules/blog/README.md`), 5/5 symbols (`publishArticle`, `runBlogPublish`, `openBlocker`,
`createPostgresBlog`, `findArticleBySlug`), 4/4 commands (`workflow.json` gates and `npm run build`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (open rename for a new and a renamed Y, committed rename; history checked after) |
| Slicing | PASS |
| Verifiability | WARN → fixed (W1) |
| Data and migrations | PASS (no schema change; research finding 5 says why no trigger) |
| Tests | PASS (BF-2's harness, required in CI) |
| Security | PASS |
| Lean | PASS (no behaviour change for a race that does not happen) |
| Fit | PASS (matches BF-2's `holdSlug` pattern) |
| Cost and defaults | PASS |
| Scope | PASS (only BF-12) |
| Reuse | PASS (`tests/postgres.ts`) |
| Lessons | PASS |
| Progress format | PASS |

## Grounding notes

- The research reproduction matches the code: the slug owner read (`articles`) precedes the history read
  (`slug_history`) in `publishArticle`, and neither locks.
- The item's outcome allows "the run is refused"; the run already is, and the tests show it.

## Findings

### W1 [WARNING] A "swapped reads" check the tests cannot make

The first draft's done criterion said the tests show the swapped order is unreachable. No test can reach
it: the bad interleaving needs X to commit between Y's two statements, and `publishArticle` has no pause
there.

**Fix (applied):** the done criterion drops it; Risks says the comment is the guard and why no test can be.

### S1 [SUGGESTION] One statement for both reads

A `UNION ALL` of the two reads would take one snapshot and make the order irrelevant.

**Decision:** not now (plan, Key decisions): the two reads already cover every commit point, and the change
would touch working code for no case that fails. Recorded in case the check is rewritten.
