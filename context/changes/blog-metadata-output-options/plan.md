# Plan: blog-metadata-output-options

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases).

## Today (master `c323892`)

- **JSON-LD ids.** `src/pages/json-ld.ts` writes `${url}#article` (BlogPosting), `${url}#term` (DefinedTerm, also in
  the glossary's `hasDefinedTerm`) and `${glossaryUrl}#glossary` (DefinedTermSet). `JsonLdContext` (exported from
  `/server`) has no field for them.
- **Cluster anchor.** `getClusterAnchor(cluster)` (`src/pages/listing.ts`) returns `cluster-<id>`; read by
  `getArticleCrumbs` (breadcrumb path `routes.index#…`) and by `BlogListingView` (section id, and `cluster-other` for
  the group without a cluster).
- **Locale.** `JsonLdContext.locale` (a `Locale`, `en`/`pl`) is written as `inLanguage`; `getTextMetadata`
  (`src/next/metadata.ts`) writes `openGraph.locale: config.locale` (bare `pl`, not an Open Graph locale); the feed
  (`src/next/discovery.ts`) writes `language: config.locale`.
- **Title.** `withBrand` in `next/metadata.ts` formats `messages.pages.titleWithBrand` for every page.
- **Options.** `blogOptionsSchema` (`src/options.ts`) has none of these; `BlogPageContext` (built only by
  `next/context.ts`) carries copy, locale, routes, brand.

## Goal

`@softure-ai/blog` 0.1.9 with every point of #240.

**Out of scope:** relative canonicals (absolute URLs are what `getSiteUrls` defines for every module; an app that
wants relative ones spreads its own `alternates`), and an empty-glossary JSON-LD (an empty `DefinedTermSet` says
nothing; `null` stays).

## Key decisions

- **Ids (1):** blog option `jsonLd: { ids: { article?, term?, glossary? } }`, defaults `article`, `term`, `glossary`,
  each a fragment without `#` (`/^[A-Za-z][A-Za-z0-9_-]*$/`, at most 40 characters). `JsonLdContext` gains an optional
  `ids` (defaults when left out, so callers that build the context by hand keep compiling).
- **Anchor (2):** blog option `anchors: { cluster? }`, default `cluster`, same pattern; the anchor is
  `<prefix>-<cluster>` and the group without a cluster `<prefix>-other` (as today). `getClusterAnchor(cluster,
  prefix = "cluster")`; `getArticleCrumbs(article, routes, labels, options?)` takes `{ clusterAnchorPrefix }`;
  `BlogPageContext` gains an optional `clusterAnchorPrefix` (default `cluster`) for the listing view.
- **Locale (3):** blog option `locales: { en?: { bcp47?, openGraph? }, pl?: {…} }`. Defaults: `bcp47` = the bare
  code (today's `inLanguage`), `openGraph` = `en_US` / `pl_PL`. Validation: BCP-47 `ll[-Script][-RR]`-like
  (`/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`), Open Graph `ll_TT` (`/^[a-z]{2,3}_[A-Z]{2}$/`). A server helper
  `getBlogLocaleTags(config)` resolves the app locale's pair; JSON-LD (`JsonLdContext.language`, optional, falls back
  to `locale`), `og:locale` and the feed's `<language>` read it.
- **Title (4):** message `glossary.termTitleWithBrand` (en and pl default `{title} | {brand}`, today's output);
  `buildTermMetadata` uses it, every other page keeps `pages.titleWithBrand`. Apps override it like any message.
- **Smaller differences (5):** README states them under the builders: `buildGlossaryJsonLd` gives `null` without
  terms, canonicals are absolute on the site origin, text pages carry `og:published_time`/`og:modified_time`, and how
  an app overrides a field by spreading the result.

## Phases

### Phase 1: options and builders (TDD)

- `options.ts` (`jsonLd`, `anchors`, `locales`), `server/options.ts` (`getBlogLocaleTags`), `pages/json-ld.ts`,
  `pages/listing.ts`, `ui/page-context.ts`, `ui/blog-listing.tsx`, `next/context.ts`, `next/json-ld.ts`,
  `next/metadata.ts`, `next/discovery.ts`, `next/pages.tsx`, messages (`termTitleWithBrand`).
- Tests: JSON-LD with custom ids (article, term, glossary and the term reference inside the glossary); crumbs and
  the listing section ids with a custom prefix; defaults unchanged; `inLanguage` from `bcp47`; `og:locale` `pl_PL` by
  default and the configured value; feed `<language>` from `bcp47`; term title from its message, article title from
  `titleWithBrand`; bad option values refused at startup.
- Done when: blog tests green.

### Phase 2: docs and version

- README (configuration, the builders' section with point 5), CHANGELOG 0.1.9, version 0.1.9 (package.json,
  module.json, `src/index.ts` if it carries the version).
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: options and builders

- [ ] jsonLd ids, cluster anchor, locale tags, term title with tests

### Phase 2: docs and version

- [ ] README, CHANGELOG, version 0.1.9
- [ ] gates green
