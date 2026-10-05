---
change_id: blog-glossary-form-conflicts
title: "A glossary form claimed by two terms is refused at publish"
status: backlog
roadmap_item: BF-4
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Two glossary terms that list the same form (or forms equal up to a capital first letter) are refused
by the publish run or the quality gate, naming both files, instead of the renderer silently linking the
form to whichever term comes first.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (blog-followups), item **BF-4**:

> ### BF-4: A glossary form belongs to one term
> - **Change ID:** `blog-glossary-form-conflicts`
> - **Status:** ready
> - **Outcome:** a check over the whole content folder (a publish-run problem or a BL-6 rule) refuses a form claimed by two terms, naming both slugs; the renderer's "first term wins" stays as the deterministic fallback.
> - **Risk:** low. An editorial mistake that links a phrase to the wrong definition; no security impact.
> - **Source:** BL-3 `blog-markdown-renderer` impl review R2 (`createTermMatcher` keeps the first term, as FIRE did).

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
