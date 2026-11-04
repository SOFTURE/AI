---
change_id: theme-notion-format-file-size-server-1005
title: "theme-notion: formatFileSize can be called from a Server Component (issue #1005)"
status: archived
roadmap_item: null
issue: 1005
branch: claude/project-thread-xoy1mu
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #1005](https://github.com/SOFTURE/AI/issues/1005): `formatFileSize` is a pure helper defined in the
`"use client"` module `src/notion/Upload.tsx`, so a Server Component that calls it gets a client reference and throws.
Move it to a plain module, guard the class of bug in the theme contract, and say in the README that it is server-safe.

## Context

- Labels: `bug`, `pkg: theme-notion`. Found in 0.11.0.
- Same class as #770 (a root export that a Server Component cannot use).

## Constraints

- No visual change; no API change (the root still exports `formatFileSize`); English only; no version bump (the
  coordinator releases).
- The guard runs for every `themes/theme-*` package.

## Notes

- Framing: skipped. The issue names the cause, the fix and the guard.
