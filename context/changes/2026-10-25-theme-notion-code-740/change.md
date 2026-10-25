---
change_id: theme-notion-code-740
title: "theme-notion: Code and CodeBlock parts (issue #740)"
status: in_progress
roadmap_item: null
issue: 740
branch: claude/project-thread-am4yoq
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #740](https://github.com/SOFTURE/AI/issues/740): the theme ships the `text-code` style and `font-mono`
but no part for inline code or a mono block, so every adopting app writes the same classes on `<code>` and `<pre>`.
Add `Code` (inline) and `CodeBlock` (block) to `@softure-ai/theme-notion`.

## Context

- Labels: `enhancement`, `pkg: theme-notion`.
- The design system's inline code: the `code` text style (13/20 mono) on `secondary`, in `red`, as in Notion.
- Adopting apps show logs and file paths in mono blocks.

## Constraints

- No syntax highlighting.
- `data-slot="code"` and `data-slot="code-block"`.
- Exported from the package root and listed in the README.
- No version bump in this change: the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the outcome and the exact API.
