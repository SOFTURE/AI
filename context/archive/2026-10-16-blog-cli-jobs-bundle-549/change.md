---
change_id: blog-cli-jobs-bundle-549
title: "blog: keep the optional @softure-ai/jobs peer out of the CLI's static graph (issue #549)"
status: archived
roadmap_item: null
issue: 549
branch: claude/project-thread-lqxwxd
created: 2026-10-16
updated: 2026-10-16
archived_at: 2026-10-16
---

## Intent

Close [issue #549](https://github.com/SOFTURE/AI/issues/549): `runBlogCli` reaches `../jobs/enqueue.js` through a
literal dynamic `import()`, and that module imports `@softure-ai/jobs/server` at its top. A bundler that follows the
literal (esbuild with `bundle: true`, `splitting: false`) inlines it, so an app that bundles the blog CLI without the
optional jobs peer fails to build, or (with the peer external) fails at startup. "Optional" must hold for bundles too.

## Context

blog 0.3.0 is the latest on npm and on master. Releases are batched by the coordinator: no version bump here, the
CHANGELOG gets `## Unreleased`.

## Constraints

- An app that installs `@softure-ai/blog` in `node_modules` keeps today's behaviour with no change to its code:
  a config with a `blog.indexnow` queue still enqueues on `publish --commit`.
- `@softure-ai/blog/jobs` keeps its public API.

## Notes

- Framing: skipped. The issue names the cause, the failure modes and two fixes.

## Decisions (auto)

- Both of the issue's options: `runBlogCli({ enqueueIndexNow })` lets an app that bundles the CLI wire the enqueue in
  from `@softure-ai/blog/jobs` explicitly; without it, the CLI loads `@softure-ai/blog/jobs` by a computed specifier
  that bundlers do not follow (self-reference through the package's `exports`), so `node_modules` installs behave as
  today. The README's bundling section documents both.
- A test bundles the CLI entry with esbuild while every `@softure-ai/jobs` specifier is unresolvable, then runs the
  bundle on real Node.
