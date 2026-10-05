---
change_id: blog-check-without-database
title: "softure-blog check without a database URL"
status: backlog
roadmap_item: BF-6
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`softure-blog check` runs in CI with an app config that has no database URL, since the gate never connects to the database.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-6**:

> ### BF-6: softure-blog check without a database URL
> - **Change ID:** `blog-check-without-database`
> - **Status:** ready
> - **Outcome:** `softure-blog check` loads an app config that has no database URL (or a placeholder) without failing: either core lets a command opt out of the database requirement, or the blog bin builds a check-only config; the weekly workflow drops its placeholder `DATABASE_URL`.
> - **Risk:** low. The reusable workflow passes a placeholder URL today; `check` never connects.
> - **Source:** BL-6 `blog-quality-gate` impl review R2.

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
