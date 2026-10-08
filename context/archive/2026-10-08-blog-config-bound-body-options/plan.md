# Plan: blog-config-bound-body-options

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package, additive).

## Goal

`/next` exports `getBodyOptions(config, terms)` and `findArticlesLinkingTermFor(config, { articles, termSlug, terms })`;
the ready-made article and term pages use them; tests, README, CHANGELOG and blog 0.1.10.

**Out of scope:** the adopting app's removal of its copy; any change to how the body input is built.

## Findings (the reading behind the plan)

- `src/next/pages.tsx` `getBodyOptions(config, context, terms)` is private; `BlogArticlePage` and
  `GlossaryTermPage` call it, the term page then calls `findArticlesLinkingTerm(articles, term.slug, bodyOptions)`.
- `src/next/json-ld.ts` shows the pattern for config-bound builders: a pure function of `config` (and the data the
  caller holds), `context` defaulting to `getPageContext(config)` where a page already has one
  (`getCrumbLabels(config, context = getPageContext(config))`).
- `findArticlesLinkingTerm`, `renderPageBody` and `RenderPageBodyOptions` are public in `/server`
  (`src/pages/index.ts` re-exported by `src/server/index.ts`).
- Nothing in these functions reads the database or the request scope: `getBlogOptions`, `getSiteUrls`,
  `toGlossary` and `getPageContext` read the config only.

## Key decisions

- **D1 Both shapes from the issue.** `getBodyOptions` is the primitive (it also lets an app render a body exactly as
  the pages do); `findArticlesLinkingTermFor` is the one-call form the term page needs. Both are a few lines; one
  without the other leaves either the list or the body as a copy.
- **D2 An options object for the finder.** `(config, articles, termSlug, terms)` would be four inputs; the
  conventions turn more than three into an options object: `findArticlesLinkingTermFor(config, { articles, termSlug, terms })`.
- **D3 One place.** The functions live in a new `src/next/body.ts`; `pages.tsx` drops its private copy and imports
  them, so the ready-made pages and an app's own pages go through the same code. `getBodyOptions` takes an optional
  third `context` (default `getPageContext(config)`), like `getCrumbLabels`, so the pages do not build it twice.
- **D4 Docs.** README "Own page components" gains a term-page example line and the two names in the builder list;
  CHANGELOG `0.1.10`; `package.json`, `module.json` and the lockfile at 0.1.10 (`auto-release` tags the version it reads from `package.json`).

## Phase 1: the exports (TDD)

- Tests (`tests/next/pages.test.tsx`, "builders for an app's own pages"):
  - `findArticlesLinkingTermFor` gives the term page's list (`index-funds` for `expense-ratio`) without reading the
    database, and the same as `findArticlesLinkingTerm(articles, slug, getBodyOptions(config, terms))`;
  - with no terms the list is empty (an unknown glossary links nothing);
  - `renderPageBody(article, getBodyOptions(config, terms))` gives the body the article page renders;
  - under seo's canonical host, `getBodyOptions(...).origins` holds `appOrigin` and the canonical origin.
- Code: `src/next/body.ts`, `src/next/pages.tsx`, `src/next/index.ts`.

Done when: the new tests were seen red (missing exports), then green; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the exports

#### Automated
- [x] 1.1 Tests seen red, then green — 76857df
- [x] 1.2 Ready-made pages use the exported functions — 76857df
- [x] 1.3 Gates green (typecheck, lint, test, build) — 76857df
- [x] 1.4 README, CHANGELOG and version 0.1.10 — 76857df
