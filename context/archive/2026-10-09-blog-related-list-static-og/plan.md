---
change_id: blog-related-list-static-og
status: archived
---

# Plan: RelatedList on /ui, static pages' Open Graph (issue #332)

Input: change.md. Complexity: small (one package, two points).

## Today (master `249899e`)

- `RelatedList({ articles, context })` in `src/ui/blog-article.tsx` writes the `related` slot on the section only;
  `src/ui/index.ts` does not export it.
- `getStaticMetadata` (`src/next/metadata.ts`) builds `openGraph: { type, title, description, url, siteName }`;
  `getTextMetadata` adds `locale: getBlogLocaleTags(config).openGraph`.

## Decisions (auto)

1. Export `RelatedList` and `RelatedListProps` from `/ui`.
2. New slots `relatedTitle`, `relatedList`, `relatedItem` with an empty default: `styles.css` styles the list through
   `.blog-related ul/li/h3`, so the default markup stays byte for byte the same.
3. Static pages always set `locale` (proposal's second option). Leaving `openGraph` out was rejected: the page would
   inherit the layout's title and URL too, which are wrong for the listing.
4. `images` (Next's `openGraph.images` type, exported as `BlogOpenGraphImages`) is an optional input of the three
   builders; `buildMethodMetadata(config, input = {})` keeps its one-argument call. The ready-made
   `generate*Metadata` stay as they are; an app that needs its card there calls the builder.

## Progress

- [x] 1. Failing test `tests/adoption-gaps-332.test.tsx` (5 failing on master).
- [x] 2. Export and slots; metadata locale and images.
- [x] 3. README, CHANGELOG under 0.1.11.
- [x] 4. Gates.
