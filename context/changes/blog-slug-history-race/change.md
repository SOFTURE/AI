---
change_id: blog-slug-history-race
title: "A slug taken while another run renames away from it stays in one place"
status: active
roadmap_item: BF-12
branch: claude/project-thread-awhjcn
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

When one `softure-blog publish` run renames article X away from slug `s` and another run, at the same
moment, gives `s` to article Y, the database never ends with `s` both as Y's current slug and as an old slug
of X in `slug_history`. A reviewer checks that two-connection Postgres tests hold X's rename open (and
committed) while Y's run asks for `s`, and that Y's run is refused naming X with nothing written.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-12, taken 2026-10-05).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-12**:

> - **Outcome:** a run that gives article Y the slug that article X is leaving in another, uncommitted run cannot leave that slug both Y's current slug and an old slug of X in `slug_history`: the run is refused (or the history entry dropped) and a two-connection Postgres test covers it.
> - **Risk:** low. Needs two publishes at the same moment; the address then serves Y while the history still names X (inferred from Postgres's unique-index semantics, not reproduced).
> - **Source:** BF-2 `blog-publish-slug-race` research, "Gap found".

BF-2 (PR #88) and BF-10 (PR #97) are on `master`; BF-2's two-connection harness is
`modules/blog/tests/postgres.ts`.

Coordinator brief (2026-10-05): only BF-12; reproduce with a two-connection test on a real Postgres first;
BF-8 runs in parallel; gaps go to the roadmap from the next free `BF-` number on `master`.

## Constraints

- Owns: `modules/blog/src/db/articles.ts` (`publishArticle`), `modules/blog/tests/publish-race.test.ts`,
  the blog README's schema paragraph.
- English-only code, comments and commits (AGENTS.md).

## Notes

- Placement: main roadmap blog-followups, item BF-12 (work now).
- Research done: the item's own risk says "not reproduced", so the first step is a reproduction
  ([`research.md`](research.md)).
- Framing skipped: research shows the race does not happen with the current code (the slug check reads
  the current slugs before the old ones); what is left is pinning that order with tests and a comment,
  which has one shape.
