---
change_id: blog-metadata-output-options
title: "blog 0.1.9: metadata and JSON-LD builders reproduce an adopting site's output (JSON-LD ids, cluster anchor, BCP-47 and Open Graph locales, term title) (issue #240)"
status: archived
roadmap_item: null
issue: 240
branch: claude/project-thread-qovehs
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #240](https://github.com/SOFTURE/AI/issues/240): the metadata and JSON-LD builders of
`@softure-ai/blog/next` (0.1.8) hard-code values an app with published pages cannot change without changing its
public output.

1. The three JSON-LD `@id` fragments (`#article`, `#term`, `#glossary`) become options.
2. The cluster anchor prefix on the listing (`cluster-<id>`, also the article breadcrumb's middle `item`) becomes an
   option.
3. The locale is split into a BCP-47 tag (JSON-LD `inLanguage`, the feed's `<language>`) and an Open Graph locale
   (`og:locale`), both configurable; `og:locale` is never a bare language again (`pl` → `pl_PL`, `en` → `en_US`).
4. Glossary terms get their own title message (`glossary.termTitleWithBrand`).
5. The smaller differences (no glossary JSON-LD without terms, absolute canonicals, `og:published_time` and
   `og:modified_time`) are documented as deliberate, so an adopter knows them up front.

A reviewer checks the blog tests (JSON-LD, listing, metadata builders, discovery), the README and the CHANGELOG.

## Context

Issue #240, found while an app moved its blog pages onto the 0.1.8 builders (#228 p. 3). Work is tracked in GitHub
Issues: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/blog` only. No other open PR touches it.
- Today's output stays the default for points 1, 2 and 4. Point 3 changes one default on purpose: `og:locale` from a
  bare `pl`/`en` (invalid Open Graph) to `pl_PL`/`en_US`; `inLanguage` and the feed language keep the bare code by
  default.
- English-only code and docs; Polish copy only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue names each hard-coded value with its file and line; reading
  `pages/json-ld.ts`, `pages/listing.ts`, `next/metadata.ts`, `next/json-ld.ts`, `next/context.ts`,
  `next/discovery.ts`, `ui/page-context.ts`, `ui/blog-listing.tsx`, `options.ts` and the messages answered every
  unknown; the findings are in plan.md's "Today" section.
- Framing: skipped. Each point is an observed adoption gap with the fix the adopter suggested; the open choices
  (option shape, defaults) are settled in the plan.
