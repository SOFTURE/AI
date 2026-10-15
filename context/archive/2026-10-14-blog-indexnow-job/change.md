---
change_id: blog-indexnow-job
title: "The blog's IndexNow submit runs as a retried job when the app uses @softure-ai/jobs (issue #493)"
status: archived
roadmap_item: null
issue: 493
branch: claude/project-thread-qu0z1q
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

After a committed publish, an app that runs `@softure-ai/jobs` gets its changed blog addresses to search engines
even when IndexNow is slow or down: the publish enqueues a `blog.indexnow` job and a worker submits it with retries,
instead of one synchronous attempt whose failure is only printed. Apps without jobs keep today's synchronous submit.

## Context

- Issue #493 (labels `enhancement`, `pkg: blog`), a follow-up of #471 (`@softure-ai/jobs`, PR #482, merged).
- Today `submitBlogChanges` (`modules/blog/src/discovery/submit.ts`) runs right after `softure-blog publish` or an
  app's `runBlogPublish`; a failure is returned as `{ kind: "failed" }` and never retried.

## Constraints

- Owns `modules/blog/` only. No change to `@softure-ai/jobs` or `@softure-ai/seo`.
- `@softure-ai/jobs` stays an optional peer: the CLI and the root entry must load without it.
- No release in this change (the coordinator batches releases); `@softure-ai/jobs` is still 0.0.0 on master.
- Never touches an adopting app's repository; the migration goes into the CHANGELOG, README and the issue comment.
- Everything in English.

## Notes

- Framing: skipped. The issue names the problem and the four asks; the owner ordered the refactor (#471 follow-up).
