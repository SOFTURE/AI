---
change_id: theme-notion-tabs-variants-server-1008
title: "theme-notion: tabsListVariants can be called from a Server Component (issue #1008)"
status: archived
roadmap_item: null
issue: 1008
branch: claude/project-thread-oyueil
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #1008](https://github.com/SOFTURE/AI/issues/1008): `tabsListVariants`, the `cva` class builder of
`TabsList`, is exported from the `"use client"` module `src/ui/tabs.tsx`, so a Server Component that calls it gets a
client reference and throws. Move it to a plain module, record the move as an upstream delta, and drop its exemption
from the client-module export guard added for #1005.

## Context

- Labels: `bug`, `pkg: theme-notion`. Found in 0.11.0.
- Builds on the branch of PR #1010 (#1005), which adds the guard and the named exemption; this change removes it.

## Constraints

- No visual change; no API change (the root still exports `tabsListVariants`); English only; no version bump (the
  coordinator releases).

## Notes

- Framing: skipped. The issue names the cause and the fix.
