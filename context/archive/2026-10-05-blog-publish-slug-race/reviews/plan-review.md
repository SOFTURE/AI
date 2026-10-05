# Plan review: blog-publish-slug-race

Reviewed: plan.md against change.md, research.md and the roadmap item BF-2 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.

## Lenses

- Outcome coverage: 23505 on `articles_slug_key` at insert and update mapped to a refusal naming the slug;
  a two-connection Postgres test.
- Contracts: the `BlogPublishRun` union and the existing refusal text for a taken slug.
- Failure paths: an aborted savepoint, a winner that is gone again, other unique violations.
- Data: all or nothing kept; no schema change.

## Findings

### W1 [WARNING] Reading after the failed write needs a usable transaction
**Where:** `publishArticleOrRefuse` → `findSlugOwner`.
**Problem:** if the failed statement aborted the whole transaction, the read would fail with 25P02 and hide
the refusal.
**Decision:** Fixed in the plan - `publishArticle` is a savepoint, rolled back by drizzle before the error
reaches the run (research 1, 3); the tests assert the winner is named, which proves the read works.

### W2 [WARNING] The outcome says "at insert, update or commit"
**Where:** the backlog entry's Outcome.
**Problem:** a mapping only at the write would miss a violation at commit.
**Decision:** Accepted - `articles_slug_key` is not deferrable, so it cannot fire at commit (research 1);
the mapping covers the two places it can fire.

### S1 [SUGGESTION] Share one Postgres test helper between billing and blog
**Decision:** Rejected for this change - it would touch billing and foundation tests outside the lane; the
copy follows the repository's existing pattern.

## Progress mechanics

One `## Progress`, last; the phase title matches; the gates item is last among the automated ones.

## Triage summary

All findings decided; nothing pending.
