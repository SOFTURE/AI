---
change_id: blog-related-list-static-og
title: "blog: export RelatedList from /ui; static pages' Open Graph keeps the locale and takes the app's card (issue #332)"
status: archived
roadmap_item: null
issue: 332
branch: claude/project-thread-am3pq4
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #332](https://github.com/SOFTURE/AI/issues/332). An adopting app moving its blog pages onto the
package's building blocks found two gaps:

1. `RelatedList` ("read next") is defined in `src/ui/blog-article.tsx` but not exported from `/ui`, so an app with
   its own article view keeps a copy of it.
2. `buildBlogIndexMetadata`, `buildGlossaryIndexMetadata` and `buildMethodMetadata` return an `openGraph` without
   `images` and `locale`. Next replaces the layout's `openGraph` with the page's object, so those pages lose the
   root card and `og:locale`.

After the change the app imports `RelatedList` (with class slots for the heading, list and item) and passes its
card as `images` to the three builders, which also set `locale`.

A reviewer checks `tests/adoption-gaps-332.test.tsx`, the README "own pages" and "views" sections and the CHANGELOG.

## Context

Filed by an adopting app on 0.1.10. 0.1.11 (#317) is merged but not released, so this folds into 0.1.11. #318
touches the blog in parallel; whoever merges second folds into the same CHANGELOG section.

## Notes

- Research: skipped as a separate file; the issue names the functions and files, and reading `src/ui/*`,
  `src/next/metadata.ts` and `src/ui/class-names.ts` answered every unknown (plan.md "Today").
- Framing: skipped; two concrete gaps with proposals.
