# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/blog`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`blog@x.y.z`).

## Unreleased

- Tool blocks (#413). `defineToolBlock({ name, schema, renderStatic, Island })` (`/ui`) turns a `::name{…}` directive
  into an interactive tool: the page's server HTML holds the static version in a mount point and `BlogToolIsland`
  (a client component) swaps in `Island` with the props the schema parsed; the Markdown answer carries the static
  version (or `markdown(props)`); `requires`, `numbers(props)`, `renderInvalid` and `className` are optional.
  `BlockPlugin.validate(block)` (new, optional) lets any directive plugin refuse readable but wrong attributes; the gate
  reports them as `block-directive`, which a tool block does with its schema's issues.
- The OG font loader lives in `@softure-ai/core/og` and an app reaches it from `@softure-ai/seo/server` for cards
  outside the blog (#414). The blog still exports `createOgFontLoader`, `loadBrandOgFonts` and their types from
  `/server` and `/next`, with the same `Blog OG card: brand.fonts[i]` messages; seo stays an optional peer.

## 0.1.12

- The method page takes the app's own sections (#380). `BlogMethodPage({ sections })` and
  `BlogMethodView({ context, sections })` take `BlogMethodSection[]` (`{ id, title, body }`, `body` a node or a string
  in a paragraph) in place of the five default sections, so a section can hold a list, a link or a `mailto:` address.
  The AI disclosure still opens the page and the footer note still closes it. New types: `BlogMethodSection`,
  `BlogMethodViewProps` (`/ui`), `BlogMethodPageProps` (`/next`).
- Fact rules read the value where the pattern points and check every year (#379). A pattern with a capture group
  reads the value from group 1 (its first number), so a sentence that quotes another amount before the keyword no
  longer fails; without a group 1 holding a number the value is the first number of the sentence, as before. The value passes when
  it is one of the values of any year the sentence names, not only the first. `onUnknownYear: "warn"` (default
  `"skip"`) makes a sentence none of whose years has values a warning of the rule's id.

## 0.1.11

- Quality and helpers for a data-driven blog (#318):
  - `BlockPlugin.numbers(block)` and the rule `block-numbers`: every significant number of the paragraph right
    before and right after a block is one of the block's numbers. `FoundBlock` gains `endLine` and `content`.
  - `quality.facts` with `factRule({ id, description, patterns, allowedValues(year), unit, expires, severity })`:
    the first number of a sentence that quotes the rule must be a value of the sentence's year (`unit` `"cents"`
    or `"bps"` for hundredths). The rules join the catalog under the group `facts`.
  - `softure-blog refresh [<path>...] [--today]` (no database) and `findTextsToRefresh`: the published texts that
    are stale or quote a fact rule whose value changed (`expires: "yearly" | "quarterly"`) after `current_as_of`.
  - `readForStaticPage(read, { onError })` (`/server`) and `getStaticPublishedArticles(config)` (`/next`): nothing
    during `next build`, nothing (logged) when the read fails.
  - `readArticleDir(dir)` (`/server`, `/cli`): the content folder as `softure-blog` reads it.
  - `createBlogProxy(config)` (`/proxy`): `createBlogMarkdown`, then `createBlogRedirects`.
  - `selectFeaturedArticles(articles, { limit })` (`/server`) and `getFeaturedArticles(config, { limit })`
    (`/next`): pillars first, then the newest.
- The views take the app's look (#317). `BlogPageContext` gains `classNames` (one class per element, see
  `BLOG_SLOT_CLASSES`), `unstyled` (drop the `blog-*` classes; `blog-visually-hidden` stays until the app maps
  it) and `layout` (the app's page frame in place of `<main class="blog-page">` and its header, given `title`,
  `lead`, `crumbs`, `meta` and `children`). The ready-made pages take them as `view`, the listing also
  `renderCard`. Without them the markup is unchanged.
- `BlogPageContext.disclaimer` is a `ReactNode`: a string renders in a paragraph as before, any other node (a
  sentence with links) as given; `view.disclaimer` replaces the configured one.
- `blog({ aiDisclosure: true })` opens the method page with an AI disclosure (`method.aiTitle`,
  `method.aiBody`; AI Act art. 50(4)) and swaps "who writes" for `method.whoBodyAi`, which claims no human
  editorial control. Default `false`.
- The OG card: `renderArticleOgImage({ logo })` draws the app's mark before the brand's name, the label line
  is `brand.colors.muted` (default the foreground, so the default card is unchanged), and
  `createBlogArticleOgImage({ logo, label })` builds the route; `BlogArticleOgImage` is the default one.
- `/server` exports `getBodyOptions`, `findArticlesLinkingTermFor`, `getPageContext` and `createOgFontLoader`
  (the same functions as `/next`), for renderers outside Next.
- `RelatedList` (the "read next" section) is exported from `/ui`, with its props `RelatedListProps`, so an app's
  own article view places it (#332). New slots `relatedTitle`, `relatedList` and `relatedItem` take the app's
  classes; they have no default class, so the markup without them is unchanged.
- The static pages' Open Graph (#332): `buildBlogIndexMetadata`, `buildGlossaryIndexMetadata` and
  `buildMethodMetadata` set `locale` as the article and term pages do, and take `images` (Next's
  `openGraph.images`), so an app carries its layout's card over; Next replaces the layout's `openGraph` with the
  page's. `buildMethodMetadata(config, { images })`; types `StaticMetadataInput` and `BlogOpenGraphImages` on
  `/next`.
- Reads driver errors with `findDriverError` and `isConstraintViolation` from `@softure-ai/db` instead of a private copy. Same behaviour;
  requires `@softure-ai/db` `^0.1.7` (#313).
- `formatDay` (`/pages`) and the `stale` quality rule use core's `formatCalendarDay` and `calendarDaysBetween`;
  same output. Requires `@softure-ai/core` `^0.1.9` (#312).
- `BLOG_RATE_LIMIT_BUCKETS` declares `key: "ip"` on `blog-refresh` (security 0.1.8 bucket kinds).
- Requires `@softure-ai/security` `^0.1.8`: earlier versions refuse the `key` field.

## 0.1.10

- `/next` exports `getBodyOptions(config, terms)`, the `RenderPageBodyOptions` the ready-made pages render
  bodies with, and `findArticlesLinkingTermFor(config, { articles, termSlug, terms })`, a glossary term page's
  "explained in these texts" list. An app with its own page components no longer copies the binding, so its
  list and body links follow the package's rule. The ready-made pages go through the same functions.
- `getDayInZone` (`/pages`) and `getLocalDate` (`/quality`) compute the day with `toCalendarDay` from
  `@softure-ai/core` instead of a local `en-CA` formatter, whose date pattern has changed between ICU versions. Same
  results; requires `@softure-ai/core` `^0.1.7` (#270).

## 0.1.9

- `og:locale` of articles and terms is an Open Graph locale now: `en_US` / `pl_PL` by default, not the bare
  `en` / `pl` (which Open Graph does not accept). `locales: { pl: { openGraph } }` sets another.
- `locales` (`blog({ ... })`): per locale, `bcp47` (JSON-LD `inLanguage` and the feed's `<language>`, default the
  bare code as before) and `openGraph` (`og:locale`). `getBlogLocaleTags(config)` (`/server`) resolves them.
- `jsonLd: { ids: { article, term, glossary } }`: the JSON-LD `@id` fragments, default `article`, `term`,
  `glossary` as before. `JsonLdContext` takes optional `ids` and `language`.
- `anchors: { cluster }`: the listing's cluster anchor prefix, default `cluster` as before; also the target of an
  article's middle breadcrumb. `getClusterAnchor(cluster, prefix?)`, `getArticleCrumbs(…, { clusterAnchorPrefix })`
  and the optional `BlogPageContext.clusterAnchorPrefix` carry it.
- Message `glossary.termTitleWithBrand` titles a glossary term's page (default `{title} | {brand}`, as before).

## 0.1.8

- `externalLinkMarker` (`blog({ ... })`) and `renderArticle({ externalMarker })`: `"icon-and-text"`
  (default, as before), `"text"` (the visually hidden "opens in a new tab" only) or `"none"`. External
  links keep `target`, `rel` and the `blog-external` class either way.
- The quality gate takes the paths of articles and terms from the blog's `routes`; `quality.paths`
  (each key optional now) only overrides them. `QualitySettings.paths` holds the resolved pair;
  `QualityOptions.paths` is the override alone.
- `/next` exports `buildArticleMetadata`, `buildTermMetadata`, `buildBlogIndexMetadata`,
  `buildGlossaryIndexMetadata`, `buildMethodMetadata`, `buildArticleJsonLd`, `buildTermJsonLd`,
  `buildGlossaryJsonLd` and `getCrumbLabels`: the ready-made pages' metadata and JSON-LD for an app
  with its own page components, without a database read.
- `gonePage` (`blog({ ... })`): `links` add further ways on to the 410 page, `render` writes its whole
  body. `buildGonePage` takes `links`.
- An imported history keeps its timestamps to the microsecond. Breaking for code that builds an
  `ArticleHistory` by hand: its timestamps are ISO strings now, not `Date` (`parseArticleHistory`
  callers see no change).

## 0.1.7

- Block plugins with `syntax: "directive"` render top-level `::name{key="value"}` lines with parsed
  `attributes`; the quality gate checks their `requires` and reports an unknown directive or unreadable
  attributes (`block-directive`). `ArticleBlock` and `FoundBlock` carry `syntax` and `attributes`.
- `createBlogMarkdown` (`/proxy`) answers an article or term asked for with `Accept: text/markdown` with
  `toArticleMarkdown`; a block plugin may give its Markdown form (`markdown`).
- `softure-blog publish --stdin` reads one file (`--name`) or a JSON bundle (files and an optional
  history) from standard input; `--format lines` prints a stable `blog|<key>|…` contract.
- `publish --history <file.json>` (and `runBlogPublish({ history })`) imports `published_at`, `updated_at`
  and old slugs on the first publish of each article, for an app moving its existing blog in.

## 0.1.6

- Adapters and commands use the configured database handle.
- `@softure-ai/ui` is a peer dependency; the package keeps its own CSS.
