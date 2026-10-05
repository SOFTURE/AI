---
change_id: blog-publish-slug-race
title: "Two publishes racing for one slug report it as a taken slug"
status: archived
roadmap_item: BF-2
branch: claude/project-thread-2z92al
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

When two `softure-blog publish` runs give one new slug to two different articles at the same moment, the
losing run is refused with `blog.slug_taken`, naming the slug and the article that took it, like any other
taken slug, instead of failing with the driver's unique violation.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-2).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-2**:

> - **Outcome:** `runBlogPublish` maps a unique violation on `articles_slug_key` (SQLSTATE 23505) to a refused run naming the slug; a two-connection test on Postgres covers it.
> - **Risk:** low. Publishing runs from one place; the database already refuses the second write, only the message is raw.
> - **Source:** BL-2 `blog-content-store` impl review R2.

Today `publishArticle` (`modules/blog/src/db/articles.ts`) reads the slug owner, then inserts or updates.
Between the read and the write another run can take the slug; the unique index `articles_slug_key` refuses
the write, and `runBlogPublish` (`modules/blog/src/db/publish-run.ts`) rethrows the driver error. The blog
README §12 lists this as a limitation.

## Constraints

- Owns `modules/blog/src/db/publish-run.ts`, the blog README §12 line, new tests in `modules/blog/tests/`.
  Lane B: BF-10 (`blog-publish-cache-refresh`) follows and touches the same files.
- English-only code, comments and commits (AGENTS.md).
- No migration, no release (`@softure-ai/blog` is not published yet; its changes ride its first publish).

## Notes

- Research kept short: one question (where and how the violation surfaces), answered by a red test on two
  Postgres connections before the plan.
- Framing skipped: a recorded review finding with a stated outcome; no premise to test.
- Archived 2026-10-05: a publish run that loses a race for a slug is refused with `blog.slug_taken`, naming the article that took it; two-connection Postgres tests cover the insert, the rename and the dry run.
