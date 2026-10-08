---
change_id: blog-config-bound-body-options
title: "blog: config-bound body options and findArticlesLinkingTermFor in /next (issue #279)"
status: archived
roadmap_item: null
issue: 279
branch: claude/project-thread-etpvfs
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

An app that keeps its own glossary term page lists "the articles that develop this term" with
`findArticlesLinkingTerm(articles, termSlug, input)` (`/server`). Its `input` (`RenderPageBodyOptions`) is
assembled privately in `src/next/pages.tsx` (`getBodyOptions`): the glossary from the published terms, the
routes, the blog options, the site's origins (`appOrigin` and the canonical site origin) and the copy. The app
has to copy those lines, and if the package later changes how it builds the body input, the app's list and the
package's term links drift apart ([#279](https://github.com/SOFTURE/AI/issues/279)).

After this change `/next` exports, next to the JSON-LD and metadata builders:

- `getBodyOptions(config, terms)`: the exact `RenderPageBodyOptions` the ready-made pages render with (so an app
  can also render a body with `renderPageBody` the same way);
- `findArticlesLinkingTermFor(config, { articles, termSlug, terms })`: the term page's list, bound to the config.

The ready-made pages use the same function, so the list and the links cannot drift.

## Context

- 0.1.8 added config-bound builders to `/next` for apps with their own page components (`buildArticleJsonLd`,
  `getCrumbLabels`, …); the README section "Own page components" lists them.
- No roadmap: issues are the tracker.

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Additive only (no breaking change): `@softure-ai/blog` 0.1.9 → 0.1.10, released after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names the private function and its line; the reading
  needed (`src/next/pages.tsx`, `src/next/json-ld.ts`, `src/pages/body.ts`, the page tests) fits in `plan.md`
  § Findings.
- Framing: skipped. The problem (a private binding an adopting app must copy) is not in doubt; the choice between
  the issue's two shapes is decision D1 in `plan.md`.
