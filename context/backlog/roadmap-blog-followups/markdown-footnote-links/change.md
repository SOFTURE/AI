---
change_id: markdown-footnote-links
title: "The repository link check skips footnote definitions"
status: backlog
roadmap_item: BF-3
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Footnote definitions in Markdown files are not reported as broken links by the repository link check, so article fixtures and docs can use footnotes as `.md` files.

## Context

From [`roadmap-blog-followups.md`](../../../foundation/roadmaps/roadmap-blog-followups.md), item **BF-3**:

> ### BF-3: The repository link check skips footnote definitions
> - **Change ID:** `markdown-footnote-links`
> - **Status:** ready
> - **Outcome:** `tests/repo/markdown-links.ts` reads a Markdown footnote definition (`[^id]: text https://…`) as a reference link definition and reports its first word as a broken relative link; footnotes are skipped and a test covers them.
> - **Risk:** low. Only test data trips it today: the blog's article fixtures are `.txt` to stay out of the check.
> - **Source:** BL-6 `blog-quality-gate` impl review R1.

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
