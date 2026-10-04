---
project: "SOFTURE AI"
roadmap: blog-followups
version: 1
status: waiting
prd_version: 2
created: 2026-10-04
updated: 2026-10-04
backlog: context/backlog/roadmap-blog-followups/
trigger: "the blog roadmap closes; the owner promotes it or takes single items"
---

# Roadmap blog-followups: gaps found while delivering the blog roadmap

> Entries: [`context/backlog/roadmap-blog-followups/`](../../backlog/roadmap-blog-followups/). Queued roadmap
> (WORKFLOW §5.1): nothing here runs until the owner promotes it to `roadmap.md`
> (`softure-roadmap --promote blog-followups`) or moves a single item into the main roadmap.
>
> The catch-all of the [`blog`](../roadmap.md) roadmap (owner, 2026-10-03: gaps found while delivering a roadmap are
> collected in a catch-all roadmap, not fixed on the spot). It starts empty. A thread that finds a gap or a
> deferred review finding:
> 1. takes the next free `BF-<n>` and a kebab-case change-id;
> 2. writes `context/backlog/roadmap-blog-followups/<change-id>/change.md` (`status: backlog`, the item block quoted
>    in Context, **Source** naming the change and the finding);
> 3. adds the row and the item block here (status `ready`, or `blocked (…)` when it waits on the owner) and the row
>    in the backlog README. Mark the severity in **Risk** and say in **Mode** whether it needs the owner.
>
> Run-wide orders (read by orchestrators once promoted):
> - Push main branch: at the end. Also push `master` after every merge. Claude reviews and merges its own
>   changes into `master` (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Release: each item that changes a published package bumps it; the owner releases at the keyboard.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |

## Order

Lanes are set when the roadmap is promoted, by shared files, like the followups roadmap
([archive](../archive/2026-10-04-roadmap.md)).

## Items

(none yet)

## Owner decisions and checks

(none yet)

## Done

(nothing yet)
