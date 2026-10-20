---
change_id: blog-og-tracing-key-620
title: "blog: README's outputFileTracingIncludes key escapes [slug] (issue #620)"
status: in_progress
roadmap_item: null
issue: 620
branch: claude/project-thread-967u1t
created: 2026-10-20
updated: 2026-10-20
---

## Intent

Close [issue #620](https://github.com/SOFTURE/AI/issues/620). README §8 ("Brand fonts" on the article OG card) tells a
standalone app to list the font folder under the key `/blog/[slug]/opengraph-image`. Turbopack reads the keys of
`outputFileTracingIncludes` as globs, where `[slug]` is a character class, so the key matches no route, the fonts are
not traced into `.next/standalone` and every card answers 500 (ENOENT).

## Context

Labels: `bug`, `pkg: blog`, `adoption`. Docs only; releases are batched by the coordinator: no version bump, the
CHANGELOG gets `## Unreleased`.

## Acceptance

- README §8 shows the escaped key (`"/blog/\\[slug\\]/opengraph-image"`) and says why the brackets are escaped.
- The escaped key also works on the webpack path (picomatch reads `\[` as a literal bracket), so one example fits both.
- CHANGELOG `## Unreleased` tells an app that copied the old key what to change.

## Notes

- Framing: skipped. The issue states the problem and the measured fix.

## Decisions (auto)

- Fix the README only; no helper export and no `softure-blog check` warning (the issue marks both optional). A helper
  would be a new public API for one string, and the check cannot see the app's `next.config` reliably. Simplest fix that
  meets the intent.
