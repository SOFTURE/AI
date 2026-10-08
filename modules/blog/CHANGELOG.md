# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/blog`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`blog@x.y.z`).

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
