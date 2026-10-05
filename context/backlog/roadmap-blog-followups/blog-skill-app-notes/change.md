---
change_id: blog-skill-app-notes
title: "The app's own sections in the generated writing skill"
status: backlog
roadmap_item: BF-9
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app adds its own procedure to the generated writing skill (where its numbers come from, its block plugins, its frontmatter fields), and `softure-blog skill install` keeps it across reinstalls.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (blog-followups), item **BF-9**:

> ### BF-9: The app's own sections in the generated writing skill
> - **Change ID:** `blog-skill-app-notes`
> - **Status:** ready
> - **Outcome:** the generated skill carries the app's own sections, from an option such as `blog({ skill: { notes } })` or from a local file the install preserves; FIRE_TRACKER's engine numbers, calculator scenario and chart block fit there; `--check` covers them.
> - **Risk:** low. Today an app keeps such guidance in a second skill of its own.
> - **Source:** BL-7 `blog-writing-skill` research, "Gaps".

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
