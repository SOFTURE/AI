---
change_id: blog-article-images
title: "Article bodies can show images under a hosting policy"
status: backlog
roadmap_item: BF-3
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An author can put an image in an article body (`![alt](src)`), and the renderer emits it only when it
follows the site's image policy: a source on the site or on an allowed host, a non-empty alt text,
known dimensions (no layout shift) and lazy loading.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-3**:

> ### BF-3: Images in article bodies
> - **Change ID:** `blog-article-images`
> - **Status:** ready
> - **Outcome:** `renderArticle({ images })` takes an image policy (allowed sources, a resolver that gives width and height); an image outside it stays text; the quality gate (BL-6) reports a missing alt or a refused source.
> - **Risk:** low. The renderer disables images today, so nothing unsafe ships; texts just cannot show one.
> - **Source:** BL-3 `blog-markdown-renderer` impl review R1 (README §12 states the limitation).

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
