---
change_id: agent-ready-next-headers-mutable
title: "agent-ready: nextHeaders() is assignable to NextConfig.headers (issue #304)"
status: archived
roadmap_item: null
issue: 304
branch: claude/project-thread-x5wi0s
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #304](https://github.com/SOFTURE/AI/issues/304): the README's mounting example
(`async headers() { return [...nextHeaders({ markdown: true })]; }` in a `next.config.ts` typed as `NextConfig`)
fails the typecheck on Next 16, because `NextHeaderRule.headers` is a `ReadonlyArray` of readonly entries while
Next's `Header.headers` is a mutable `{ key: string; value: string }[]`. Spreading the outer array leaves the inner
one readonly.

`NextHeaderRule` becomes a mutable structural copy of Next's `Header` entry, so the example typechecks as written and
an adopting app drops its `map(...)` copy. A test assigns `nextHeaders()` to a `NextConfig`'s `headers()`, so the
README example stays true.

A reviewer checks `modules/agent-ready/src/link-header.ts`, the new test in `tests/documents.test.ts`, the README
example and the CHANGELOG entry.

## Context

Issue #304, filed by an adopting app on `@softure-ai/agent-ready` 0.1.1 (on npm); 0.1.2 was released while this change was open, so the fix ships as 0.1.3. Work is
tracked in GitHub Issues: no roadmap item; the PR closes the issue.

## Constraints

- `link-header.ts` keeps importing nothing (it loads in `next.config.ts`; the architecture test forbids `next`
  imports in the root entry). The type stays a structural copy.
- Runtime output unchanged: same rule, same `Link` value.
- English-only code and docs; no copy changes.

## Process notes

- Research: skipped as a separate file. The issue names the type, the error and the fix; `link-header.ts` (51 lines)
  and Next's `Header` type answer every unknown; findings are in plan.md's "Today" section.
- Framing: skipped. The failure is observed with its cause; the issue's two fixes are settled in plan.md.
