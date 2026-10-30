---
change_id: remove-stray-node-modules-link
title: "Remove a stray node_modules symlink committed with #908"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-m7utty
created: 2026-10-30
updated: 2026-10-30
archived_at: 2026-10-30
---

## Intent

PR #914 carried `themes/theme-notion/node_modules`, a symlink to itself left by a local worktree setup. It breaks
`npm ci` and the pre-push hook ("too many levels of symbolic links") in a fresh checkout. Remove it, and ignore
`node_modules` as a file or link too, not only as a directory.

## Notes

- Research and framing: skipped, the cause is known (the link was staged with `git add themes/theme-notion`).
