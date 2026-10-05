---
change_id: blog-publish-slug-race
title: "Two publishes racing for one slug report it as a taken slug"
status: backlog
roadmap_item: BF-2
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

When two `softure-blog publish` runs give one new slug to two different articles at the same moment, the
losing run reports `blog.slug_taken` like any other taken slug, instead of failing with the driver's
unique violation.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (blog-followups), item **BF-2**:

> ### BF-2: A slug race reports a taken slug
> - **Change ID:** `blog-publish-slug-race`
> - **Status:** ready
> - **Outcome:** `runBlogPublish` maps a unique violation on `articles_slug_key` (SQLSTATE 23505) at insert, update or commit to a refused run naming the slug; a two-connection test on Postgres covers it.
> - **Risk:** low. Publishing runs from one place (a release or the owner); the database already refuses the second write, only the message is raw.
> - **Source:** BL-2 `blog-content-store` impl review R2 (README §12 states the limitation).

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
