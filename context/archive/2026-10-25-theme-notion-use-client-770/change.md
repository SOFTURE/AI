---
change_id: theme-notion-use-client-770
title: "theme-notion: the package root imports from a Server Component again (issue #770)"
status: archived
roadmap_item: null
issue: 770
branch: claude/project-thread-q3ll8h
created: 2026-10-25
updated: 2026-10-25
archived_at: 2026-10-25
---

## Intent

Close [issue #770](https://github.com/SOFTURE/AI/issues/770): `@softure-ai/theme-notion` 0.3.0 cannot be imported
from a React Server Component, because `src/ui/item.tsx` calls `React.createContext` at module level and lacks the
`"use client"` directive. Mark the file as a client module and add a guard so no theme ships such a file again.

## Context

- Labels: `bug`, `pkg: theme-notion`.
- Regression from #747 (the `ItemGroup` context for axe `aria-required-children`), shipped in 0.3.0.

## Constraints

- No visual change; no API change; English only; no version bump (the coordinator releases 0.3.1).
- The guard runs for every `themes/theme-*` package, so a new theme is covered by being created.

## Notes

- Framing: skipped. The issue names the cause, the fix and the guard.
