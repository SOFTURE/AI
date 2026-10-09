# @softure-ai/blog

Articles and glossary terms kept as Markdown files in the app's repository, and a publish command that
brings the module's tables to the state of those files. The files are the source of truth: there is no
editor and no CMS, a text changes only through a commit and `softure-blog publish`.

## 1. What it provides

- A strict article file format: a YAML frontmatter with English keys (an unknown key is an error),
  extendable by the app's own fields, then the Markdown body.
- `blog.articles` and `blog.slug_history` with database constraints for every invariant that fits one.
- `softure-blog publish`: a dry run by default; with `--commit`, all files or none; unchanged files are
  skipped by their content hash; a slug change keeps the old slug as a redirect; one pillar per cluster.
  Files from paths or from standard input (`--stdin`, for a release through an ssh pipe), a line
  contract for scripts (`--format lines`), and the dates and old slugs of an existing blog imported on
  the first publish (`--history`).
- Read functions for the pages: `getPublishedArticle`, `findArticleBySlug`, `findSlugRedirect`,
  `listArticles`.
- `renderArticle(markdown, options)`: the body as safe HTML on the server (no raw HTML, safe link
  schemes only, marked external links, images under the app's image policy), heading ids and an
  optional table of contents, glossary links on the first mention of a term, block plugins for the
  app's own fenced blocks and `::directive{…}` lines, reading time.
- Pages, each mounted with one re-export line (`@softure-ai/blog/next`): the listing grouped by cluster
  with the pillar first, an article (dates, summary, contents, FAQ, sources, signature, disclaimer,
  `BlogPosting`/`BreadcrumbList`/`FAQPage` JSON-LD), the glossary index and a term page (`DefinedTerm`,
  the articles that explain it), the optional "how our texts are made" page, an article's OG card.
  Their canonical, Open Graph, JSON-LD and feed URLs follow `@softure-ai/seo`'s origin, host and
  trailing-slash rule when the app lists `seo()` (core's `getSiteUrls`), and `appOrigin` otherwise.
- `createBlogRedirects` (`@softure-ai/blog/proxy`): 301 from an old slug, 410 for a withdrawn text,
  in the app's `proxy.ts`; `createBlogMarkdown` answers an article or term asked for with
  `Accept: text/markdown` with its Markdown (`toArticleMarkdown`), for agents.
- `@softure-ai/blog/styles.css`: the pages and the rendered body on the `--sft-*` tokens.
- Discovery: an RSS 2.0 feed (`serveBlogRss`), "read next" under every article (its cluster first, the
  pillar on top), and, with `@softure-ai/seo` (optional): sitemap entries with each text's real
  `lastmod` (`blogSitemap()`) and an IndexNow submit of the changed addresses after
  `softure-blog publish --commit` (`submitBlogChanges` for an app's own publishing path).
- A cache refresh route (`refreshBlogCache`, rate-limited through `@softure-ai/security`, a secret from
  `BLOG_REFRESH_SECRET`): `softure-blog publish --commit` calls it before the IndexNow submit, so the
  running app shows the change at once instead of after `revalidateSeconds`.
- A text quality gate: `softure-blog check` reports structure, link, style, voice and YMYL findings
  with file and line, and `publish` refuses a text going public with an error. Language rulesets
  (`en`, `pl`), severity overrides and rule plugins for the app's own domain; numbers next to a data
  block checked against the block, fact rules for values the app knows per year, and
  `softure-blog refresh` listing the texts whose numbers wait for a check.
- `softure-blog skill install`: an agent skill for writing the texts, generated from the gate's rules
  and the app's config, with `--check` for CI.

## 2. Installation

```bash
npm install @softure-ai/blog @softure-ai/ui
```

`@softure-ai/ui` is a peer dependency (any 0.1.x), like the optional `@softure-ai/security` and
`@softure-ai/seo`: the app installs it once, so the theme tokens come from one copy. Importing
`@softure-ai/blog/styles.css` from JavaScript is safe with tree-shaking, because the package marks its CSS as a side
effect.

Then add `blog()` to the modules of `softure.config.ts` and run `softure migrate`.

## 3. Configuration

```ts
import { blog } from "@softure-ai/blog";
import { pl } from "./messages/pl";
import { z } from "zod";

blog({
  // The folder `softure-blog publish` reads when no path is given. Default: "content/blog".
  contentDir: "content/blog",
  // Extra slugs an article may not take. The routes' own segments (the glossary, the method page
  // when on) are reserved by themselves. Default: none.
  reservedSlugs: [],
  // The app's own frontmatter keys, checked by the app's schema. Default: none.
  fields: z.object({ scenario: z.string().regex(/^[a-z]=\d+(&[a-z]=\d+)*$/).optional() }),
  // The pages' brand: title suffix, signature, JSON-LD author and publisher, OG card colours (hex)
  // and fonts (§8). Default: none (no suffix, no author, the ui theme's dark colours, next/og's font).
  // colors.muted is the OG card's label line (default: the foreground).
  brand: { name: "Example", colors: { background: "#0b0b0c", foreground: "#f5f5f5", accent: "#7aa2f7" } },
  // Mount the method page at routes.method. Default: false (the route answers 404).
  methodPage: true,
  // The texts are written by an AI model: the method page opens with the disclosure (AI Act art. 50(4),
  // method.aiTitle / method.aiBody) and "who writes" says method.whoBodyAi. Default: false.
  aiDisclosure: false,
  // A note under every article and term, per locale (en required). Default: none.
  disclaimer: { en: "Education, not financial advice.", pl: pl.blog.disclaimer },
  // The heading of each cluster on the listing, per locale; a missing key shows the key. Default: {}.
  clusters: { "investing-basics": { en: "Investing basics", pl: pl.blog.investingBasics } },
  // Block plugins of renderArticle, used by the pages. Default: [].
  blocks: [],
  // Hosts of the app besides APP_ORIGIN's and seo's canonical host, whose links are not external. Default: [].
  siteHosts: ["www.example.com"],
  // What follows an external link in a body: "icon-and-text" (a ↗ hidden from screen readers and a
  // visually hidden "opens in a new tab"), "text" (the hidden words only) or "none". Default: "icon-and-text".
  externalLinkMarker: "icon-and-text",
  // The `@id` fragments of the JSON-LD nodes (no `#`): `<url>#article`, `<term url>#term`,
  // `<glossary url>#glossary`. An app that already published other fragments keeps them here.
  jsonLd: { ids: { article: "article", term: "term", glossary: "glossary" } },
  // The listing's cluster sections are `<cluster>-<key>`; an article's middle breadcrumb points there.
  // Default: { cluster: "cluster" }.
  anchors: { cluster: "cluster" },
  // The language tags per locale: `bcp47` for JSON-LD inLanguage and the feed's <language> (default:
  // the bare code, "en" or "pl"), `openGraph` for og:locale (language_TERRITORY; default "en_US" / "pl_PL").
  locales: { pl: { bcp47: "pl-PL", openGraph: "pl_PL" } },
  // The 410 page of a withdrawn text: extra links, or the app's own body (§4). Default: one link to the listing.
  gonePage: { links: [] },
  // Which images bodies may show: site paths and https images on these hosts (subdomains included),
  // with a width and height the app knows. Used by the pages and the quality gate. Default: none
  // (every image renders as its alt text and the gate refuses it).
  images: { hosts: ["cdn.example.com"], dimensions: (src) => imageSizes[src] ?? null },
  // How long the cached reads hold; keep equal to the pages' `revalidate`. Default: 300.
  revalidateSeconds: 300,
  // The app's own sections of the generated writing skill (see "The writing skill"). Default: none.
  skill: { sections: [] },
  // Every route can move: blog({ routes: { index: "/articles" } }).
});
```

Routes: `index` `/blog` (articles at `/blog/<slug>`), `glossary` `/blog/glossary` (terms at
`/blog/glossary/<slug>`), `method` `/blog/how-we-write`.

`fields` may not reuse a key of the module (`FRONTMATTER_KEYS`). Its parsed value is stored in
`articles.fields`, enters the content hash and must be plain JSON.

### The quality gate

On by default with the `en` ruleset; `quality: false` turns it off. Every key is optional:

```ts
blog({
  quality: {
    language: "pl",                        // the ruleset: "en" (default) or "pl"
    ymyl: { ownCalculationMark: "our calculation" }, // or true / false (default): sources, sourced numbers, no profit promises
    voice: {
      forbidFirstPersonSingular: true,     // texts signed by the editors: no "I", "my"
      // a global RegExp; wordPattern (from @softure-ai/blog) adds the i flag and word edges in any alphabet
      phrases: [{ id: "finance-cliche", pattern: wordPattern("in the world of finance"), message: "say what happens instead" }],
    },
    limits: { words: { article: { min: 600, max: 4000 } }, answerWords: 70 }, // the defaults
    severity: { exclamation: "error", "lead-number": "off" }, // per rule: "error", "warning" or "off"
    paths: { terms: "/glossary" },  // only to override the routes: articles default to routes.index, terms to routes.glossary
    ownOrigins: ["https://www.example.com"], // absolute links that count as internal, besides appOrigin and seo's origin
    appDir: "src/app",                     // routes for internal links; default src/app, else app
    privateRouteSegments: ["api", "(app)"], // route folders that are no link target; default ["api"]
    plugins: [factsPlugin],                // the app's own rules, see Hooks
    blocks: [chartBlock],                  // the block plugins of renderArticle: their requires (and numbers) are checked
    facts: [ikeLimit],                     // values the texts quote that the app knows per year (below)
  },
});
```

The rules, by group (`listQualityRules(getQualitySettings(config))` lists them with their effective
severity; the writing skill is kept in step with it):

| Group | Rules (errors **bold**) |
| --- | --- |
| file | **`file`**: the frontmatter parses and the slug equals the file name |
| structure | `title-length`, `description-length`, **`as-of-future`**, `stale`, **`summary-missing`**, **`lead`** (a paragraph first), `lead-length`, **`lead-number`**, **`heading-h1`**, **`heading-order`**, **`sections`** (two `##`), **`section-question`**, **`section-answer`**, `section-answer-length`, **`length`** (a warning above the maximum), **`footnote-undefined`**, `footnote-unused` |
| links | **`internal-links`** (a warning for a term), **`internal-link-target`** (`check` only), `external-link-https`, **`external-link-dead`** (`--external` only), **`term-form-conflict`** (`check` only: a checked published term shares a form with another published term; `publish` refuses it whatever its severity) |
| images | **`image-source`** (a site path or a host of `blog({ images })`; every image while the app has no policy), **`image-alt`**, **`image-dimensions`** (the policy's `dimensions` knows it) |
| style (ruleset) | **`announcement`**, **`these-days`**, **`not-only-but-also`**, **`not-x-but-y`**, **`meta-commentary`**, **`throat-clearing`**, **`empty-conclusion`**, **`crucial`**, **`plays-a-role`**, **`puffery`**, **`chatbot-phrases`**, **`emoji`**, `filler-words`, `exclamation`, `straight-quotes` (`pl`), `title-case-heading` (`pl`) |
| style (rhythm) | **`dashes`**, `dashes-paragraph`, `bold-density`, `bold-labels`, `triads`, `long-sentences`, `monotone-rhythm`, `repeated-openings` |
| voice | **`first-person-singular`** and the app's phrases, when configured |
| ymyl | **`sources-missing`**, **`source-https`**, **`number-source`**, **`footnote-source`**, **`footnote-not-in-sources`**, **`profit-promise`**, when `ymyl` is on |
| blocks | **`block-requires`**: a fenced block of a block plugin has the frontmatter keys it `requires`, when `blocks` is set; **`block-numbers`**: every significant number of the paragraph right before and right after a block is one of the block's `numbers`, when a block plugin has `numbers` |
| facts | the app's fact rules (`quality.facts`), each under its own id |
| plugin | the plugins' rules, **`plugin-failed`**, **`plugin-rule-undeclared`** |

Style patterns match the prose of the body and the title, description and summary (errors only
there). A warning pattern is reported once per text with its count. A significant number is an
amount, a percentage or a number from 1000 up, in the ruleset's notation; years, ages, small counts
and legal references ("art. 27", "section 401") need no source. Messages are English: they are read
by developers and by the agents that write the texts.

**Numbers next to a block.** A block plugin with `numbers(block)` (the block's numbers, as numbers or
as strings in the ruleset's notation) gets the `block-numbers` rule: the significant numbers of the
paragraph right before the block and right after it must each equal one of them, so the prose and the
chart or table cannot drift apart. A percentage compares by its number (`4.5` for "4.5%"). A throwing
`numbers` is a `block-numbers` error, not a crash.

**Fact rules.** A value a text quotes that the app knows per year (a contribution limit, a tax rate):

```ts
import { factRule } from "@softure-ai/blog/server";

export const ikeLimit = factRule({
  id: "ike-limit",
  description: "the yearly IKE contribution limit",
  patterns: [/IKE limit/i, /limit (of|for) IKE/i], // a sentence that quotes the value
  allowedValues: (year) => ({ 2025: [2_652_000], 2026: [2_826_050] })[year], // nothing: the year is not checked
  unit: "cents",       // "value" (default), "cents" or "bps": the values are hundredths of the text's number
  expires: "yearly",   // "yearly", "quarterly" or "never" (default), for softure-blog refresh
  severity: "error",   // default
});
```

In every sentence of the body that matches a pattern, the first number (years and legal references
skipped) is the value; its year is the first year in the sentence, else the year of `current_as_of`.
A value that is not one of `allowedValues(year)` is a finding of the rule's id. The rules join the
catalog (group `facts`), so the writing skill lists them.

**Texts to refresh.** `softure-blog refresh [<path>...] [--today <YYYY-MM-DD>]` lists, without a
database, the published texts whose numbers wait for a check: `current_as_of` older than
`limits.staleAfterDays`, or a quoted fact rule whose value changed (its year or quarter began) after
`current_as_of`. It exits 0: it reports, it does not gate. `findTextsToRefresh(files, settings, today)`
(`/server`) is the same list for an app's own report.

### The article file

One file per text, named `<slug>.md`:

```markdown
---
id: index-funds            # stable key, given once; never change it
slug: index-funds          # the address; equals the file name without .md
kind: article              # article | term (a glossary definition); default article
forms: [tax wrapper]       # term only, required: the phrases that link to the definition
cluster: investing-basics  # the topic for "read next" lists; optional
pillar: true               # the main text of its cluster: one per cluster, needs cluster; default false
title: Index funds in plain words
description: One or two sentences for search results and the social card.
summary: A few sentences with numbers for the "in short" box; optional.
status: published          # draft | published | withdrawn
current_as_of: 2026-10-01  # the day the facts were checked
published_at: 2026-10-01   # optional; a day (midnight UTC) or a moment with an offset; default: first publication
sources:
  - name: Fund factsheet
    url: https://example.com/factsheet
faq:
  - question: Is it safe?
    answer: It follows the market, up and down.
---

The Markdown body.
```

Rules:

- **Slug change:** change `slug` and rename the file, keep `id`. The old slug goes to the slug history
  and redirects to the new one. A slug another article has now, or had before, is refused.
- **Glossary forms:** a form belongs to one published term (forms equal up to a capital first letter
  are one). `publish` refuses a run that leaves a form with two terms, one of them in the run, naming
  the form and both slugs; a conflict only between stored terms is a warning. `check` reports it as
  `term-form-conflict`. The renderer links such a form to the first term it was given.
- **Withdrawal:** `status: withdrawn`. The row stays and its address answers 410. Do not delete the
  file: a deleted file changes nothing in the database.
- **Update date:** `updated_at` moves by itself when the content of a published text changes (title,
  description, summary, body, date of the facts, sources, FAQ, cluster, forms, fields), never on a
  status, slug, publication date or pillar change alone.

## 4. Mounting

Each page is one file in the app. Next reads `dynamic` and `revalidate` only as literals in the app's
own file, so they stay there; `revalidate` should equal `revalidateSeconds`.

```tsx
// app/blog/page.tsx: the listing, rendered per request over cached reads
export { BlogIndexPage as default, generateBlogIndexMetadata as generateMetadata } from "@softure-ai/blog/next";
export const dynamic = "force-dynamic";

// app/blog/[slug]/page.tsx: an article, kept for 300 s (ISR); slots take the app's components
import { BlogArticlePage, type BlogArticlePageProps } from "@softure-ai/blog/next";
export { generateArticleMetadata as generateMetadata, generateBlogStaticParams as generateStaticParams } from "@softure-ai/blog/next";
export const revalidate = 300;
export default function Page({ params }: Pick<BlogArticlePageProps, "params">) {
  return <BlogArticlePage params={params} cta={<MyCta />} afterArticle={<Waitlist placement="blog" />} />;
}

// app/blog/[slug]/opengraph-image.tsx
export { BlogArticleOgImage as default, generateBlogStaticParams as generateStaticParams } from "@softure-ai/blog/next";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

// app/blog/glossary/page.tsx          GlossaryIndexPage, generateGlossaryIndexMetadata; dynamic = "force-dynamic"
// app/blog/glossary/[slug]/page.tsx   GlossaryTermPage, generateTermMetadata, generateBlogStaticParams; revalidate
// app/blog/how-we-write/page.tsx      BlogMethodPage, generateMethodMetadata (with methodPage: true)

// app/blog/rss.xml/route.ts: the feed of published articles and terms, linked from the listing and articles
export { serveBlogRss as GET } from "@softure-ai/blog/next";
export const dynamic = "force-dynamic";
```

With `@softure-ai/seo`, the blog joins its sitemap through a contributor; `app/sitemap.ts` must then be
`force-dynamic` (the contributor reads the database):

```ts
// softure.config.ts (the root entry: this file also loads in plain Node and in bundles outside Next)
import { blog, blogSitemap } from "@softure-ai/blog";
seo({ sitemap: { contributors: [blogSitemap()] }, indexNow: { key: "..." } });
```

The entries are the listing, the articles, the glossary and its terms, each dated by its last content
change (`updated_at`, else `published_at`), and the method page without a date; an empty listing or
glossary is left out (it is `noindex`). Paths only: seo makes them absolute with its canonical rule.
The contributor reads with one query per sitemap request, not through the pages' Next cache.

A publish from the command runs outside the app and cannot reach its cache. To show the change at once
instead of after `revalidateSeconds`, mount the refresh route, list `security()` with the blog's bucket,
and set one secret (32+ characters, e.g. `openssl rand -base64 32`) as `BLOG_REFRESH_SECRET` for both the
running app and the command:

```ts
// app/api/blog/refresh/route.ts (routes.refresh, default /api/blog/refresh)
export { refreshBlogCache as POST } from "@softure-ai/blog/next";

// softure.config.ts
import { BLOG_RATE_LIMIT_BUCKETS, blog } from "@softure-ai/blog";
security({ clientIp: cloudflareIp(), buckets: { ...BLOG_RATE_LIMIT_BUCKETS } });
```

The route counts every request in the `blog-refresh` bucket (10 per 15 minutes per client address;
callers without one, such as the command on a private network name, share one count) before it checks
`Authorization: Bearer <secret>`, then expires the blog's cache tag at once (`revalidateTag(BLOG_CACHE_TAG,
{ expire: 0 })`: the next request reads the tables, the cached pages included). Answers: 204 refreshed,
401 a missing or wrong secret, 429 over the bucket (`retry-after`), 503 when counting fails, 500 when
`BLOG_REFRESH_SECRET` is unset or short (logged by name). Without `security()` or its bucket the route
throws a setup error naming the fix.

301 and 410 are answered before the page, in `proxy.ts` (Node.js runtime, Next 16):

```ts
import { createBlogRedirects } from "@softure-ai/blog/proxy";
const blogRedirects = createBlogRedirects(softureConfig);

export async function proxy(request: NextRequest) {
  return (await blogRedirects(request)) ?? NextResponse.next();
}
```

`createBlogProxy` (below, under "Markdown for agents") answers Markdown first and then the redirects.
It handles GET and HEAD on the blog's text paths only, keeps the query on a redirect, remembers a
decision for 60 s (`ttlMs`) and passes a request on when the database fails. Import the styles after
ui's: `@import "@softure-ai/blog/styles.css";`. A data change shows after `revalidateSeconds`, or at
once with `revalidateTag(BLOG_CACHE_TAG, { expire: 0 })` (the refresh route above, for the command). Custom OG fonts: an own `opengraph-image.tsx` calling `renderArticleOgImage({ title, label, brand, fonts })`.

**Articles on the app's own pages.** `getFeaturedArticles(config, { limit })` (`/next`) answers published
articles for a featured strip, the pillars first and then the newest (`selectFeaturedArticles` in
`/server` is the pure part). On a prerendered page (a home page), `getStaticPublishedArticles(config)`
answers none during `next build` (there is no database) and none, logged, when the read fails, so the
page still renders; `readForStaticPage(read, { onError })` (`/server`) wraps any read the same way.

**The content folder in scripts.** `readArticleDir(dir)` (`/server` and `/cli`) reads the folder as
`softure-blog` does: every `*.md` file directly in it except `README.md`, sorted by name, as
`{ ok: true, files: [{ name, text, path }] }`, or `{ ok: false, error }`. A test store or a script hands
the files to `runBlogPublish` or `checkArticleFiles`.

The quality gate resolves internal links under the blog's `routes` (`index` for articles, `glossary`
for terms), so moving a route moves the check with it; `quality.paths` only overrides them.

The 410 page carries the module's copy (`gone.*`) and one link to the listing. `gonePage.links` adds
further ways on (a path from the site root or an https URL, a label per locale, at most five), and
`gonePage.render` writes the whole body with the app's own HTML and styles; the proxy still answers 410
with `text/html`:

```ts
blog({
  gonePage: {
    links: [{ href: "/calculator", label: { en: "Try the calculator", pl: pl.blog.goneCalculator } }],
    // or the whole page: (input) => html, with input.copy, input.lang, input.indexPath, input.links
    render: ({ copy, lang, indexPath, links }) => renderMyGonePage({ copy, lang, indexPath, links }),
  },
});
```

**Own page components.** An app whose blog keeps its own look mounts its own pages and keeps the rest.
`generate*Metadata`, `generateBlogStaticParams` and `BlogArticleOgImage` mount next to its own page as
above. For a text the app already read (`getTextBySlug`), `/next` builds the same metadata and JSON-LD
the ready-made pages use, with no database read, so the app can extend them:

```tsx
// app/blog/[slug]/page.tsx with the app's own view
import { buildArticleJsonLd, buildArticleMetadata, getTextBySlug } from "@softure-ai/blog/next";
import { getSoftureConfig } from "@softure-ai/core/next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const config = getSoftureConfig();
  const article = await getTextBySlug(config, (await params).slug);
  return article?.status === "published" && article.kind === "article" ? buildArticleMetadata(config, article) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const config = getSoftureConfig();
  const article = await getTextBySlug(config, (await params).slug);
  if (article?.status !== "published" || article.kind !== "article") notFound();
  return (
    <MyArticleView article={article}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildArticleJsonLd(config, article) }} />
    </MyArticleView>
  );
}
```

The builders: `buildBlogIndexMetadata(config, { isEmpty })`, `buildArticleMetadata(config, article)`,
`buildGlossaryIndexMetadata(config, { isEmpty })`, `buildTermMetadata(config, term)`,
`buildMethodMetadata(config)`, `buildArticleJsonLd(config, article)`, `buildTermJsonLd(config, term)` and
`buildGlossaryJsonLd(config, terms)` (`null` without terms); the JSON-LD comes serialized, safe inside a
`<script>`. `getCrumbLabels(config)` gives the breadcrumb names for `getArticleCrumbs`/`getTermCrumbs`
(`/server`); `getPageContext`, `renderPageBody` and `getRelatedArticles` render the rest.

A body and a term's "explained in these texts" list take the input the ready-made pages build, so an own page
links and lists exactly as they do:

```tsx
const [articles, terms] = await Promise.all([getPublishedArticles(config), getPublishedTerms(config)]);
const body = renderPageBody(term, getBodyOptions(config, terms)); // renderPageBody from /server
const explainedIn = findArticlesLinkingTermFor(config, { articles, termSlug: term.slug, terms });
```

`getBodyOptions(config, terms)` is the `RenderPageBodyOptions` of the pages (the glossary, routes, blog options,
`appOrigin` and the canonical site origin, the copy); `findArticlesLinkingTermFor` is `findArticlesLinkingTerm`
(`/server`) over it.

What the builders write, so an app moving published pages onto them can match its old output:

- the JSON-LD `@id` fragments, the cluster anchor and the language tags come from `jsonLd`, `anchors` and
  `locales` (above);
- a page title is `pages.titleWithBrand` (`{title} | {brand}`), a glossary term's
  `glossary.termTitleWithBrand`; override either message per locale;
- canonical, Open Graph and JSON-LD URLs are absolute on the site origin (`@softure-ai/seo`'s when listed);
- articles and terms carry `og:published_time` and `og:modified_time`, the days the page shows;
- `buildGlossaryJsonLd` gives `null` without terms (an empty `DefinedTermSet` says nothing).

Any field can still be replaced by spreading the result: `{ ...buildTermMetadata(config, term), title }`.

`getBodyOptions`, `findArticlesLinkingTermFor` and `getPageContext` need no request scope: `/server` exports the
same functions, for a renderer outside Next.

**The package's views in the app's look.** An app with its own design system keeps the views and gives them its
classes, its page frame and its cards. Every ready-made page takes `view` (and the listing `renderCard`); a view
from `/ui` reads the same fields from its `context`:

```tsx
// app/blog/[slug]/page.tsx
import { BlogArticlePage, type BlogArticlePageProps } from "@softure-ai/blog/next";
import { Breadcrumbs, type BlogLayoutSlotProps, type BlogViewOptions } from "@softure-ai/blog/ui";

function BlogFrame({ context, title, lead, crumbs, meta, children }: BlogLayoutSlotProps) {
  return (
    <PageFrame title={title} lead={lead} aside={meta}>
      {crumbs === undefined ? null : <Breadcrumbs crumbs={crumbs} label={context.messages.pages.breadcrumbs} context={context} />}
      {children}
    </PageFrame>
  );
}

const view: BlogViewOptions = {
  classNames: { article: "prose", card: "card", cardTitle: "card-title", visuallyHidden: "sr-only" },
  unstyled: true, // only the app's classes; leave it out to add them after the package's
  layout: BlogFrame, // the app's frame instead of <main class="blog-page"> and its header
  disclaimer: <p>Education, not financial advice. <a href="/terms">Terms</a></p>,
};

export default function Page(props: BlogArticlePageProps) {
  return <BlogArticlePage {...props} view={view} />;
}
// app/blog/page.tsx: <BlogIndexPage view={view} renderCard={({ article, href, isLead }) => <AppCard … />} />
```

- `classNames` names the element, the class without `blog-` in camelCase: `page`, `header`, `title`, `lead`,
  `crumbs`, `card`, `cardLead`, `cardTitle`, `article`, `section`, `disclaimer`… (`BLOG_SLOT_CLASSES` lists them
  with their defaults). The app's class follows the package's, which sits in the `softure` layer, so it wins.
- `unstyled` drops the `blog-*` classes. Text meant for screen readers only keeps `blog-visually-hidden` until
  `classNames.visuallyHidden` names the app's own class.
- `layout` gets `{ context, title, lead, crumbs, meta, children }`; without it the markup is the package's.
- `renderCard` gets `{ article, href, isLead, context }` and replaces the card inside its list item.
- `disclaimer` replaces the configured one: a string renders in a paragraph, any other node as given.

The commands:

```bash
softure-blog publish [<path>...] [--commit] [--withdraw] [--no-indexnow] [--app-url <origin>]
                     [--stdin [--name <slug>.md]] [--history <file.json>] [--format text|lines] [--config <file>]
softure-blog check [<path>...] [--external] [--today <YYYY-MM-DD>] [--config <file>]
softure-blog skill install [--dir <path>] [--command <cmd>] [--check] [--config <file>]
```

- `<path>` is a file or a folder (every `*.md` but `README.md`, by name); without one, `contentDir`.
- `--commit` writes; without it the command prints what it would do and writes nothing.
- `--withdraw` publishes the one given file as `withdrawn` (taking a text down at once); set the file's
  status too, or the next full publish brings the text back.
- A done run prints one `cache:` line. With `BLOG_REFRESH_SECRET` set, a commit that changed a text
  posts to the app's refresh route on `appOrigin` (`--app-url <origin>` for another way in, such as
  `http://web:3000` in a container network; redirects are not followed) before the IndexNow submit; a
  dry run prints the address. Without the secret the line says the app shows the change after
  `revalidateSeconds`. A failed refresh is a warning naming the answer: the publish stays written, the
  IndexNow submit still goes out and the exit code stays 0. `--no-indexnow` does not skip it.
- With `seo({ indexNow: { key } })` enabled, a run ends with one `indexnow:` line. A commit submits the
  addresses whose answer changed (a text public before or after, its old slug after a rename, the
  listing or the glossary of its kind) as canonical URLs on seo's origin; a dry run prints them;
  `--no-indexnow` skips the submit (e.g. a local or CI database). A failed submit is a warning: the
  publish stays written and the exit code stays 0.
- `--stdin` reads the files from standard input instead of paths: with `--name <slug>.md`, the one file's
  text; without it, a JSON bundle `{"files":[{"name":"<slug>.md","text":"…"}]}` (a whole folder, and
  optionally `"history"`, the content of a `--history` file, so a container needs no file for it). A
  release that publishes inside a container through an ssh gateway pipes the content in, so the image
  needs no copy of `content/`. `--stdin` takes no paths; `--withdraw` with it needs `--name`.
- `--history <file.json>` imports the earlier life of an existing blog (see "Moving an existing blog in").
- `--format lines` prints the line contract below instead of the text for people.
- Exit codes: 0 done, 1 refused or failed (nothing written), 2 usage error.

Output, one line per text, then a summary:

```text
added index-funds none -> published/index-funds
changed bonds draft/bonds -> published/bonds
moved bonds bond-basics -> bonds
summary: added 1, changed 1, unchanged 12
dry run: nothing written; pass --commit to write
```

**The line contract** (`--format lines`), for a release script that greps the output. Every line goes to
standard output and starts `blog|`; fields are separated by `|`, and a `|` or a line break inside a value
becomes a space. Keys are stable: a new one may be added, an existing one never changes meaning. A run
prints exactly one outcome line: `blog|written`, `blog|dry-run`, `blog|refused` or `blog|failed|<message>`.

```text
blog|warning|<subject>|<message>
blog|error|<subject>|<message>
blog|change|<added|changed|unchanged>|<id>|<status/slug before, or none>|<status/slug after>
blog|moved|<id>|<old slug>|<new slug>
blog|imported|<id>|<published_at ISO, or none>|<old slugs>
blog|summary|<added>|<changed>|<unchanged>
blog|written
blog|cache|off|<revalidateSeconds>         | skipped | dry-run|<url> | refreshed|<url> | failed|<code>|<reason>
blog|indexnow|off|<reason>                 | skipped | dry-run|<count>|<urls> | submitted|<count>|<status>|<paths> | failed|<code>|<reason>|<paths>
```

```bash
# A release step: the content goes in on stdin, the contract comes back.
node -e 'const fs = require("fs"); const dir = "content/blog";
  const files = fs.readdirSync(dir).filter((n) => n.endsWith(".md") && n !== "README.md").sort()
    .map((name) => ({ name, text: fs.readFileSync(`${dir}/${name}`, "utf8") }));
  process.stdout.write(JSON.stringify({ files }))' > bundle.json
OUT="$(ssh deploy@host 'docker compose exec -T app node blog.cjs publish --stdin --commit --format lines' < bundle.json)"
grep -q '^blog|written$' <<< "$OUT" || { grep '^blog|\(error\|failed\)' <<< "$OUT"; exit 1; }
```

**Moving an existing blog in.** An app that already published its texts from its own tables keeps their
`published_at` (often only in its database, not in the files), their `updated_at` and their old slugs
with `--history <file.json>`. On the first publish of each article (no row in `blog.articles` yet), the
article takes `published_at` from the history unless its file sets one, `updated_at` from the history,
and its old slugs enter `blog.slug_history` (301s keep working); the run prints `imported` for it. An
article that already has a row ignores its entry, so the same file can stay in a release script; an
entry for an article outside the run is a warning. An old slug another article holds refuses the run.

```json
{
  "articles": [
    {
      "id": "index-funds",
      "published_at": "2026-03-01T08:00:00+01:00",
      "updated_at": "2026-06-15T10:30:00Z",
      "old_slugs": [{ "slug": "what-is-an-index-fund", "changed_at": "2026-04-01T00:00:00Z" }]
    },
    { "id": "draft-text", "published_at": null }
  ]
}
```

`published_at` is required (`null` for a text never published), `updated_at` needs it, ids and slugs are
kebab-case, each article and old slug appears once. Timestamps reach Postgres as the text given, so a
`timestamptz` copied to the microsecond (`…:12.421579Z`) is stored to the microsecond and an import can be
checked by equality in SQL; Postgres rounds digits past the sixth. One query over
an app's own tables (here `blog_articles(id, published_at, updated_at)` and
`blog_slug_history(old_slug, article_id, changed_at)`) writes the file:

```sql
\copy (SELECT json_build_object('articles', coalesce(json_agg(json_build_object(
  'id', a.id, 'published_at', a.published_at, 'updated_at', a.updated_at,
  'old_slugs', coalesce((SELECT json_agg(json_build_object('slug', h.old_slug, 'changed_at', h.changed_at))
                         FROM blog_slug_history h WHERE h.article_id = a.id), '[]'::json))), '[]'::json))
  FROM blog_articles a) TO 'history.json'
```

`publishArticle(ctx, input, { history })` and `runBlogPublish(ctx, files, { history })` (with
`parseArticleHistory(json)`) are the same import without the command line.

Like `softure migrate`, the bin loads `softure.config.(ts|mts|js|mjs)` with Node and opens
`database.handle` when the config sets one, otherwise `database.url`. When Node cannot load the config (path aliases, a bundled container), call
`runBlogCli` from an app script:

```ts
// scripts/blog.ts
import { runBlogCli } from "@softure-ai/blog/cli";
import config from "../softure.config";

process.exitCode = await runBlogCli({ config, argv: process.argv.slice(2) });
```

`publish` runs the quality gate on every file going public (status `published`, not `--withdraw`);
one error refuses the run. The gate in `publish` does not resolve internal link targets, since a
container that publishes may hold no app folder; run `check` in CI for those. `runBlogCli({ gate })`
replaces the gate; `runBlogPublish` in `@softure-ai/blog/server` is the same run without a command line.
After an app's own run, `submitBlogChanges(config, run.changes, { commit: run.committed })` submits the
same addresses; inside Next, call `revalidateTag(BLOG_CACHE_TAG, { expire: 0 })` first, and outside it
`requestBlogRefresh(config, run.changes, { commit: run.committed })` (`@softure-ai/blog/server`), so a
crawler that answers the ping at once gets the new text.

`check` and `skill install` need no database, nor a database URL: the bin loads the config with the
database optional for them (`@softure-ai/core`'s `withDatabaseOptional`), so a CI job without
`DATABASE_URL` runs them. An app script that runs them wraps its own import the same way:
`const { default: config } = await withDatabaseOptional(() => import("../softure.config"))`. `check` reads the
files (default: `contentDir`), resolves internal links against the app's routes and the published texts
of `contentDir`, compares the glossary forms of the checked terms with every published term there, reads
every `brand.fonts` source as the OG card's route does (a path from the working directory, an `https`
URL fetched, so a job with such a font needs network), and prints one line per finding:

```text
content/blog/index-funds.md:12: error [crucial] "crucial": a favourite word of language models; name what depends on the thing
content/blog/bonds.md: OK
check: 2 file(s), 1 error(s), 0 warning(s): red, do not publish
```

Exit codes: 0 green (warnings allowed), 1 an error, 2 usage error. `--external` also requests every
external link (HEAD, then GET when a server refuses HEAD; 2xx after redirects). Run it weekly with the
reusable workflow of this repository, `.github/workflows/blog-links.yml` (its header holds the
snippet for the app).

### The writing skill

`softure-blog skill install` writes an agent skill for writing the blog's texts into
`.claude/skills/blog-write/` (`--dir` to change). It walks the agent through a text: the question,
facts with sources, a draft by an answer-first structure, a rewrite by the rules, `check`, a
sceptical second agent with its own prompt, `check --external`, and `publish`. The package ships the
templates in `skill/`; the command fills them from the app's config:

- the language of the texts, the content folder, the article and glossary paths and every limit;
- `references/rules.md`: exactly the rules the app's gate enforces (`listQualityRules`), each with
  its effective severity, what the gate looks for and what to write instead; the app's voice
  phrases and plugin rules with their own descriptions; a rule set to `"off"` is left out;
- the YMYL passages (sources, footnotes, the own calculation mark) only when `ymyl` is on, and the
  editors' "we" when `voice.forbidFirstPersonSingular` is on;
- the app's own sections from `blog({ skill: { sections } })` (below).

The app adds its own procedure (where its numbers come from, its block plugins, its fields) as sections
in the config, so a reinstall keeps them and `--check` covers them:

```ts
blog({
  skill: {
    sections: [
      { title: "Engine numbers", body: "Every number of an example comes from `npm run engine -- <inputs>`." },
      { title: "Chart block", body: "One `::chart{scenario=\"…\"}` block after the lead, with the frontmatter's `scenario`." },
    ],
  },
});
```

Install writes them to `references/app.md` (`## <title>` and the body, verbatim, never filled like the
templates) and `SKILL.md` names them; with no sections the file is not written. A title is one line, unique,
up to 80 characters; a body holds no `#` or `##` heading outside fenced code (use `###`). An app with long
sections keeps them in a module of its own and imports them into the config.

`--command` sets how the skill runs the commands (default `npx softure-blog`; an app with a
`runBlogCli` script passes e.g. `--command "npm run blog --"`). Commit the folder, so agents in a
fresh clone have it, and run `softure-blog skill install --check` (with the same options) in CI, with no
`DATABASE_URL` needed: it writes nothing and exits 1, naming the files, when the folder differs from what
the config gives.
Install overwrites only a folder whose `SKILL.md` it generated, so it never replaces a skill the app
wrote itself. That folder belongs to the command: install removes a `.md` file in it that the config no
longer gives (`references/app.md` once the sections are gone), logging `removed <path>`, and `--check`
names such a file. With `quality: false` it refuses: the skill is built on the gate.

### Rendering an article

```ts
import { getPublishedArticle, listArticles, renderArticle, toGlossary } from "@softure-ai/blog/server";

const article = await getPublishedArticle(ctx, slug);
const glossary = toGlossary(await listArticles(ctx, { kind: "term" }));
const body = renderArticle(article.bodyMarkdown, {
  glossary,
  selfSlug: article.kind === "term" ? article.slug : undefined,
  termHref: (term) => `/blog/glossary/${term}`, // the default
  siteHosts: ["example.com"], // subdomains included; other hosts are external
  images: { hosts: ["cdn.example.com"], dimensions: (src) => imageSizes[src] ?? null }, // see Images below
  toc: true, // or { maxLevel: 4 }; h2 and h3 by default
  messages: blogMessages.pl.render, // English by default
  blocks: [chartBlock],
  article: { currentAsOf: article.currentAsOf, fields: article.fields },
});
// body.html (null when a block returned a node), body.segments, body.headings, body.toc,
// body.linkedTerms, body.readingMinutes
```

- **Allowlist by construction:** raw HTML in the text is escaped, so the output holds only the
  elements Markdown produces. Links keep `http(s)`, `mailto`, relative and `#` targets; any other
  scheme (`javascript:`, `data:`, entity-encoded or split by whitespace) stays text.
- **Images** (`![alt](src "title")`) follow the image policy (`images`): the source is a site path
  (`/images/x.png`; never `//host` or a path relative to the page) or an `https:` URL on a host in
  `images.hosts` (subdomains included), the alt text is not empty, and `images.dimensions(src)` returns
  positive whole `{ width, height }`. Such an image renders as `<img class="blog-image">` with its
  `width`, `height`, `loading="lazy"` and `decoding="async"`; any other renders as its alt text, and
  without `images` every image does. `src` is the URL the page requests (percent-encoded: a space is
  `%20`). A throwing `dimensions` fails the render (a bug); the gate reports it as `image-dimensions`.
  `checkArticleImage` and `findArticleImages` give the same verdict and the images of a text.
- **External links** (`http(s)` or `//` to a host outside `siteHosts`) get `rel="noopener noreferrer"`,
  `target="_blank"`, the class `blog-external`, a `↗` marker hidden from screen readers and a visually
  hidden "(opens in a new tab)". `externalMarker: "text"` keeps only the hidden words, `"none"` neither
  (the pages: `blog({ externalLinkMarker })`).
- **Headings** get ids from their text (letters folded to ASCII, `-2` for a repeat, `section` without
  letters); `toc` renders `<nav class="blog-toc">` with nested lists.
- **Glossary:** the first mention of each term form links to its definition; never inside headings,
  links, code or footnotes, never a term page to itself. The longest form wins, word bounds are
  Unicode-aware, case is as written (plus a capital first letter). A hand-written link to a term counts.
- **Footnotes** (`[^id]`) become numbered references and a notes section with links back.

**Block plugins.** A top-level fence whose type an app registers is rendered by the app:

````md
```chart wealth
scenario: early-retirement
```
````

```ts
const chartBlock: BlockPlugin = {
  type: "chart",
  requires: ["current_as_of", "scenario"], // frontmatter keys the block reads, for the quality gate
  render: ({ info, content, article }) => ({ kind: "html", html: renderChart(info, content, article) }),
  // or { kind: "node", node: <Chart … /> } for a React server component
};
```

Plugin output is the app's own code and is trusted as is: escape what goes into its HTML. A plugin
that throws fails the render (a bug, not content). Without the plugin the same fence renders as a code
block. `findArticleBlocks(markdown, plugins)` lists the blocks a text uses with their line, syntax,
attributes and `requires`, without rendering. When any block returns a node, `html` is `null`: render
`segments` in order (`html` segments as HTML, `node` segments as they are).

**Directive plugins.** A plugin with `syntax: "directive"` renders a top-level line `::name{…}` instead
of a fence, the way many Markdown blogs embed a chart or a tool:

```md
Paragraph before.
::chart{type="wealth" scenario="w=35&d=300000" title="Your wealth"}
```

```ts
const chartDirective: BlockPlugin = {
  type: "chart",
  syntax: "directive",
  requires: ["current_as_of"],
  render: ({ attributes, article }) =>
    attributes === null
      ? { kind: "html", html: '<figure class="chart-error">…</figure>' }
      : { kind: "html", html: renderChart(attributes, article) },
  markdown: ({ attributes }) => chartAsTable(attributes), // optional, for Accept: text/markdown
};
```

- The line stands alone (it may follow a paragraph line directly); the braces are optional; values are
  double-quoted and hold no `"`; each key appears once. `attributes` holds them, `info` the raw text
  inside the braces, `content` the whole line. Attributes that cannot be read reach the plugin as `null`
  (show an error frame) and the gate refuses them.
- Only top-level lines count: a directive in a list, a quote, a fence or indented code stays text, and
  so does a name no directive plugin registers. One type may have a fence plugin and a directive plugin.
- Register the same plugins in `quality.blocks`: the gate reports a directive's missing `requires`, and
  with any directive plugin registered `block-directive` reports a `::name` line no plugin renders (a
  typo would show as a paragraph) or one whose attributes cannot be read.
- `parseDirectiveLine` and `parseDirectiveAttributes` (`@softure-ai/blog/server`) are the parser.

**Markdown for agents.** `createBlogMarkdown(config)` (`@softure-ai/blog/proxy`) answers a GET or HEAD
of a published article or term whose `Accept` names `text/markdown` with at least the weight of
`text/html` (never `*/*`: browsers and crawlers keep the page) with `toArticleMarkdown(article)`: the
title, description, the day the facts were checked, the summary, the stored body, sources and FAQ.
Plugin blocks keep their source unless the plugin has `markdown`. The answer carries `Vary: Accept` and
`cache-control: private`, so a shared cache never hands Markdown to a browser. Put it before the redirects:

```ts
const blogMarkdown = createBlogMarkdown(softureConfig);
const blogRedirects = createBlogRedirects(softureConfig);
export async function proxy(request: NextRequest) {
  return (await blogMarkdown(request)) ?? (await blogRedirects(request)) ?? NextResponse.next();
}
```

`createBlogProxy(config, options)` is both pieces in that order, with one `getContext` (and `ttlMs`,
`onError`):

```ts
const blogProxy = createBlogProxy(softureConfig);
export async function proxy(request: NextRequest) {
  return (await blogProxy(request)) ?? NextResponse.next();
}
```

## 5. Migrations and tables

Schema `blog`, migration `0001_create_articles.sql`:

| Table | Holds |
| --- | --- |
| `blog.articles` | one row per text: id, slug, kind, cluster, pillar, title, description, summary, body, status, `current_as_of`, `published_at`, `updated_at`, sources, FAQ, term forms, the app's fields, content hash, `created_at` |
| `blog.slug_history` | each old slug with its article (the 301 target); removed with the article |

Constraints: id, slug, cluster and old slug kebab-case (at most 100 characters); kind and status
closed lists; text lengths; a published text has a publication date; an update date needs one; a
pillar has a cluster; a term has forms and an article has none; a unique slug; one pillar per cluster
among texts not withdrawn (an exclusion constraint deferred to commit, so one run can move the pillar).
"A slug is not in another article's history" stays in the code, under a row lock; the check reads the current
slugs before the old ones, so a slug that another run is renaming away from is refused, naming that article,
whether the rename has committed or not. A run that loses a race for
a slug (another run committed it between the read and the write) is refused with `blog.slug_taken`,
naming the article that took it, like any other taken slug.

## 6. Environment variables

| Variable | Required | Read by |
| --- | --- | --- |
| `BLOG_REFRESH_SECRET` | no | the refresh route (`refreshBlogCache`) and `softure-blog publish`: the shared secret, 32+ characters; without it a publish shows after `revalidateSeconds` |

The command reads the database URL from the app's config.

## 7. Switches

None.

## 8. Appearance

`styles.css` styles every `blog-*` class of the pages and of the rendered body (`blog-external`,
`blog-external-marker`, `blog-visually-hidden`, `blog-term`, `blog-toc`, `blog-footnote-ref`,
`blog-footnotes`, `blog-footnote-back`) with the `--sft-*` tokens of `@softure-ai/ui`, in the
`softure` layer, so the app's own rules win; class slots and a layout (§4, "The package's views in the app's
look") take the app's own. The OG card takes `brand.colors`, else ui's dark theme; its label line is
`brand.colors.muted`, else the foreground.

An app's mark on the OG card, and another label under the title, come from the route built by
`createBlogArticleOgImage` (`BlogArticleOgImage` is the one built with no options):

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { createBlogArticleOgImage } from "@softure-ai/blog/next";
export { generateBlogStaticParams as generateStaticParams } from "@softure-ai/blog/next";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;
// The logo is drawn before the brand's name: flex layout and inline styles, images as data or https URLs.
export default createBlogArticleOgImage({ logo: <AppMark size={40} />, label: "The journal" });
```

An app's other OG cards read fonts the same way with `createOgFontLoader({ root })` (`/server` or `/next`).

The OG card writes in `brand.fonts`, else in `next/og`'s default font:

```ts
blog({
  brand: {
    name: "Example",
    fonts: [
      // weight: 100…900 (default 400), style: "normal" | "italic" (default "normal")
      { name: "Inter", weight: 400, src: "assets/fonts/inter-latin-400-normal.woff" },
      { name: "Inter", weight: 700, src: "assets/fonts/inter-latin-700-normal.woff" },
      // a second file of one weight (a latin-ext subset) under its own name: the card lists every name
      // in order, so it draws the characters the first file lacks
      { name: "Inter Ext", weight: 700, src: "https://cdn.example.com/inter-latin-ext-700-normal.woff" },
    ],
  },
});
```

- `src` is a `.ttf`, `.otf` or `.woff` file (Satori does not read `.woff2`): a path from the app's root,
  an absolute path, or an `https` URL. Marketing-kit's subset files (`brand.fonts` of `marketing.json`)
  fit as they are.
- The card's route reads each file on its first card and keeps it for the life of the process. A file
  that cannot be read, or is not such a font, fails the card with a message naming `brand.fonts[i]` and
  the file; the next card tries again. `softure-blog check` reads the same sources, so CI reports such a
  file first (`softure-blog check: Blog OG card: brand.fonts[0] …`, one error, exit 1).
- Paths are read on the Node.js runtime (the route's default). With `output: "standalone"`, list the
  folder in `outputFileTracingIncludes` (`{ "/blog/[slug]/opengraph-image": ["./assets/fonts/**"] }`);
  a route moved to the edge runtime takes `https` URLs only.
- With brand fonts the card has no other font: a character none of them has is not drawn.

## 9. Copy

`src/messages/`: labels of the kinds (`kinds.article`, `kinds.term`) and statuses (`statuses.*`) in
`en` and `pl`; the renderer's copy under `render.*` (notes heading, footnote label with `{number}`,
back to text, opens in a new tab, contents label), passed as `renderArticle({ messages })`; the pages'
copy under `pages.*`, `glossary.*`, `method.*`, `gone.*` (the 410 page), `og.*` and `feed.*` (the feed's 503 body); "read next" is `pages.readNext`. Override any of it
with `blog({ messages: { pl: { pages: { readMore: "..." } } } })`. Command output and file errors are developer output, in English.

## 10. Hooks

- `blog({ fields })`: the app's frontmatter schema (e.g. a calculator scenario per article).
- `gate` of `runBlogPublish` and `runBlogCli`: `(file, article) => problems`, called only for files
  going public; any problem refuses the whole run. Default in `runBlogCli`: `createQualityGate`.
- `blog({ quality: { plugins } })`: the app's domain rules. A plugin declares its rules and checks one
  text at a time; it is pure (no network, no file system) and its findings take part in severity
  overrides and the catalog. A throw becomes `plugin-failed`, an undeclared rule id
  `plugin-rule-undeclared`.

```ts
import type { QualityPlugin } from "@softure-ai/blog/server";

export const tickerPlugin: QualityPlugin = {
  name: "tickers",
  rules: [{ id: "ticker-format", severity: "error", description: "tickers are written in capitals" }],
  check: ({ blocks }) =>
    blocks
      .filter((block) => /\$[a-z]{2,5}\b/.test(block.text))
      .map((block) => ({ rule: "ticker-format", severity: "error", message: "write the ticker in capitals", line: block.line })),
};
```

  The context holds the parsed `article` (with the app's `fields`), the body `blocks` with file lines
  (directives such as `::chart{…}` are blocks of their own), the fenced `pluginBlocks` of the block
  plugins in `quality.blocks` (type, info, fence line, `requires`), `today` and the language `ruleset` (for
  its number notation); the text helpers (`toProse`, `splitSentences`, `findSignificantNumbers`, …) are
  exported from `@softure-ai/blog/server`.
- `renderArticle({ blocks })` and `blog({ blocks })`: block plugins for the app's fenced blocks and
  `::directive` lines (an engine chart), with an optional Markdown form for agents.
- The pages' `cta` and `afterArticle` slots: the app's call to action and blocks (a waitlist form).

## 11. GDPR

Articles hold editorial content, no personal data: nothing to export or delete.

## 12. Limitations

- Two runs that rename one article away from a slug and give it to another at the same moment can leave the
  slug both current and in the slug history (BF-12).
- The content hash is part of the contract: a field added later enters it only when present.
- The refresh route expires the cache of the instance that answers it. With several instances and Next's
  default (in-memory) cache handler, the others show a publish after `revalidateSeconds`; a shared cache
  handler covers them.
- The renderer has no raw HTML and no figures: an image has no caption, and the app hosts and sizes its
  images itself (no `next/image`). A plugin fence inside a list or a quote stays a code
  block (a block node cannot sit inside a list's HTML), and a `::directive` there stays text; the gate
  does not report a registered directive in such a place.
- Only leaf directives (`::name{…}`, one line): no container (`:::name … :::`) or inline (`:name[…]`) ones.
- The gate reads Markdown line by line (blocks, not a syntax tree): enough for the rules, not a
  renderer. Fenced code and HTML comments are skipped.
- **Adopting an app's own Polish gate:** `language: "pl"`, `ymyl: { ownCalculationMark }` with its calculation
  footnote's phrase, `voice.forbidFirstPersonSingular: true` plus its own phrases, its domain as
  `ownOrigins`, `privateRouteSegments: ["api", "(app)"]`, and its own fact and chart rules as plugins
  (the package's tests hold stand-ins of both). Rule ids are English (`kluczowy` → `crucial`,
  `myslniki` → `dashes`, …; the map is in the change archive), and the writing skill (`skill install`,
  replacing an app's own writing skill) names them; the app's own numbers, calculator scenario and chart
  block go into `blog({ skill: { sections } })`.
- **Adopting Polish frontmatter keys:** rename the frontmatter keys once (`typ` → `kind` with `artykul` →
  `article` and `termin` → `term`, `formy` → `forms`, `klaster` → `cluster`, `filar` → `pillar`,
  `tytul` → `title`, `opis` → `description`, `w_skrocie` → `summary`, `aktualne_na` →
  `current_as_of`, `opublikowano` → `published_at`, `zrodla` → `sources` with `nazwa` → `name`,
  `faq` items `pytanie` → `question` and `odpowiedz` → `answer`), move `scenariusz` into the app's
  `fields`, and copy the rows into `blog.articles` with the hash the package computes from the renamed
  files, or the first publish marks every published text as updated.
