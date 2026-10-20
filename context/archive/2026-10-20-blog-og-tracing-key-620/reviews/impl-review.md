---
change_id: blog-og-tracing-key-620
reviewed: 2026-10-20
verdict: approved
---

# Implementation review: blog-og-tracing-key-620

Checked the diff (8f456ef) against change.md, plan.md and issue #620.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | README §8 writes `"/blog/\\[slug\\]/opengraph-image"`, the issue's measured key, as a plain JS string (plan review #2). | No change. |
| 2 | Check | The reason is stated (keys are globs, Turbopack reads `[slug]` as a character class, ENOENT on every card) and that webpack accepts the same key; picomatch `isMatch("/blog/[slug]/opengraph-image", "/blog/\\[slug\\]/opengraph-image")` is `true`. | No change. |
| 3 | Check | CHANGELOG `## Unreleased` tells an app that copied the old key what to change. No code, no version bump. | No change. |

No findings to fix. Gates: language gate (pre-commit), `tests/repo` (pre-push).
