---
change_id: blog-slug-history-race
title: "A slug taken while another run renames away from it stays in one place"
status: backlog
roadmap_item: BF-12
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

When one `softure-blog publish` run renames article X away from slug `s` and another run, at the same
moment, gives `s` to article Y, the database never ends with `s` both as Y's current slug and as an old slug
of X in `slug_history`.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (blog-followups), item **BF-12**:

> ### BF-12: A slug taken while another run renames away from it
> - **Change ID:** `blog-slug-history-race`
> - **Status:** proposed
> - **Outcome:** a run that gives article Y the slug that article X is leaving in another, uncommitted run cannot leave that slug both Y's current slug and an old slug of X in `slug_history`: the run is refused (or the history entry dropped) and a two-connection Postgres test covers it.
> - **Risk:** low. Needs two publishes at the same moment; the address then serves Y while the history still names X (inferred from Postgres's unique-index semantics, not reproduced).
> - **Source:** BF-2 `blog-publish-slug-race` research, "Gap found".

Y's run reads `s` as X's slug (`blog.slug_taken`) only if it reads before X's run commits. If Y's insert
happens while X's update is still open, it waits on X's old index entry and succeeds once X commits; the
slug-history read happened earlier and saw nothing.

## Constraints

- English-only code, comments and commits (AGENTS.md).
- Reuse BF-2's two-connection harness (`modules/blog/tests/postgres.ts`).

## Notes
