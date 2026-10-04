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
| **BF-1** | `cli-config-loader` | `softure migrate`, `softure-mail` and `softure-blog` load the app config through one shared loader | — | autonomous | ready |
| **BF-2** | `blog-publish-slug-race` | two publishes racing for one slug report `blog.slug_taken`, not a driver error | — | autonomous | ready |

## Order

Lanes are set when the roadmap is promoted, by shared files, like the followups roadmap
([archive](../archive/2026-10-04-roadmap.md)).

## Items

### BF-1: One config loader for module commands
- **Change ID:** `cli-config-loader`
- **Status:** ready
- **Input:** [`cli-config-loader`](../../backlog/roadmap-blog-followups/cli-config-loader/change.md)
- **Outcome:** `findDefaultConfig`, `takeConfigOption` and `loadConfig` live once (in `@softure-ai/core` or `@softure-ai/db`) and the three bins use them; their tests keep the same messages.
- **Prerequisites:** none.
- **Risk:** low. Three copies of about 60 lines that have not drifted yet.
- **Mode:** autonomous.
- **Source:** BL-2 `blog-content-store` impl review R1.

### BF-2: A slug race reports a taken slug
- **Change ID:** `blog-publish-slug-race`
- **Status:** ready
- **Input:** [`blog-publish-slug-race`](../../backlog/roadmap-blog-followups/blog-publish-slug-race/change.md)
- **Outcome:** `runBlogPublish` maps a unique violation on `articles_slug_key` (SQLSTATE 23505) to a refused run naming the slug; a two-connection test on Postgres covers it.
- **Prerequisites:** none.
- **Risk:** low. Publishing runs from one place; the database already refuses the second write, only the message is raw.
- **Mode:** autonomous.
- **Source:** BL-2 `blog-content-store` impl review R2.

## Owner decisions and checks

(none yet)

## Done

(nothing yet)
