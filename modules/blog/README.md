# @softure-ai/blog

Articles and glossary terms kept as Markdown files in the app's repository, and a publish command that
brings the module's tables to the state of those files. The files are the source of truth: there is no
editor and no CMS, a text changes only through a commit and `softure-blog publish`.

This release holds the content store (roadmap item BL-2), the server-side renderer (BL-3), the pages
(BL-4) and the text quality gate (BL-6). RSS, sitemap and IndexNow (BL-5) build on them.

## 1. What it provides

- A strict article file format: a YAML frontmatter with English keys (an unknown key is an error),
  extendable by the app's own fields, then the Markdown body.
- `blog.articles` and `blog.slug_history` with database constraints for every invariant that fits one.
- `softure-blog publish`: a dry run by default; with `--commit`, all files or none; unchanged files are
  skipped by their content hash; a slug change keeps the old slug as a redirect; one pillar per cluster.
- Read functions for the pages: `getPublishedArticle`, `findArticleBySlug`, `findSlugRedirect`,
  `listArticles`.
- `renderArticle(markdown, options)`: the body as safe HTML on the server (no raw HTML, safe link
  schemes only, marked external links), heading ids and an optional table of contents, glossary links
  on the first mention of a term, block plugins for the app's own fenced blocks, reading time.
- Pages, each mounted with one re-export line (`@softure-ai/blog/next`): the listing grouped by cluster
  with the pillar first, an article (dates, summary, contents, FAQ, sources, signature, disclaimer,
  `BlogPosting`/`BreadcrumbList`/`FAQPage` JSON-LD), the glossary index and a term page (`DefinedTerm`,
  the articles that explain it), the optional "how our texts are made" page, an article's OG card.
- `createBlogRedirects` (`@softure-ai/blog/proxy`): 301 from an old slug, 410 for a withdrawn text,
  in the app's `proxy.ts`.
- `@softure-ai/blog/styles.css`: the pages and the rendered body on the `--sft-*` tokens.
- A text quality gate: `softure-blog check` reports structure, link, style, voice and YMYL findings
  with file and line, and `publish` refuses a text going public with an error. Language rulesets
  (`en`, `pl`), severity overrides and rule plugins for the app's own domain.

## 2. Installation

```bash
npm install @softure-ai/blog
```

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
  // The pages' brand: title suffix, signature, JSON-LD author and publisher, OG card colours (hex).
  // Default: none (no suffix, no author, the ui theme's dark colours).
  brand: { name: "FIRE Tracker", colors: { background: "#0b0b0c", foreground: "#f5f5f5", accent: "#7aa2f7" } },
  // Mount the method page at routes.method. Default: false (the route answers 404).
  methodPage: true,
  // A note under every article and term, per locale (en required). Default: none.
  disclaimer: { en: "Education, not financial advice.", pl: pl.blog.disclaimer },
  // The heading of each cluster on the listing, per locale; a missing key shows the key. Default: {}.
  clusters: { "investing-basics": { en: "Investing basics", pl: pl.blog.investingBasics } },
  // Block plugins of renderArticle, used by the pages. Default: [].
  blocks: [],
  // Hosts of the app besides APP_ORIGIN's, whose links are not external. Default: [].
  siteHosts: ["www.example.com"],
  // How long the cached reads hold; keep equal to the pages' `revalidate`. Default: 300.
  revalidateSeconds: 300,
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
    limits: { words: { article: { min: 600, max: 4000 } }, answerWords: 70 }, // FIRE's values are the defaults
    severity: { exclamation: "error", "lead-number": "off" }, // per rule: "error", "warning" or "off"
    paths: { articles: "/blog", terms: "/blog/glossary" },    // where internal links to texts point
    ownOrigins: ["https://www.example.com"], // absolute links that count as internal, besides appOrigin
    appDir: "src/app",                     // routes for internal links; default src/app, else app
    privateRouteSegments: ["api", "(app)"], // route folders that are no link target; default ["api"]
    plugins: [factsPlugin],                // the app's own rules, see Hooks
    blocks: [chartBlock],                  // the block plugins of renderArticle: their requires are checked
  },
});
```

The rules, by group (`listQualityRules(getQualitySettings(config))` lists them with their effective
severity; the writing skill is kept in step with it):

| Group | Rules (errors **bold**) |
| --- | --- |
| file | **`file`**: the frontmatter parses and the slug equals the file name |
| structure | `title-length`, `description-length`, **`as-of-future`**, `stale`, **`summary-missing`**, **`lead`** (a paragraph first), `lead-length`, **`lead-number`**, **`heading-h1`**, **`heading-order`**, **`sections`** (two `##`), **`section-question`**, **`section-answer`**, `section-answer-length`, **`length`** (a warning above the maximum), **`footnote-undefined`**, `footnote-unused` |
| links | **`internal-links`** (a warning for a term), **`internal-link-target`** (`check` only), `external-link-https`, **`external-link-dead`** (`--external` only) |
| style (ruleset) | **`announcement`**, **`these-days`**, **`not-only-but-also`**, **`not-x-but-y`**, **`meta-commentary`**, **`throat-clearing`**, **`empty-conclusion`**, **`crucial`**, **`plays-a-role`**, **`puffery`**, **`chatbot-phrases`**, **`emoji`**, `filler-words`, `exclamation`, `straight-quotes` (`pl`), `title-case-heading` (`pl`) |
| style (rhythm) | **`dashes`**, `dashes-paragraph`, `bold-density`, `bold-labels`, `triads`, `long-sentences`, `monotone-rhythm`, `repeated-openings` |
| voice | **`first-person-singular`** and the app's phrases, when configured |
| ymyl | **`sources-missing`**, **`source-https`**, **`number-source`**, **`footnote-source`**, **`footnote-not-in-sources`**, **`profit-promise`**, when `ymyl` is on |
| blocks | **`block-requires`**: a fenced block of a block plugin has the frontmatter keys it `requires`, when `blocks` is set |
| plugin | the plugins' rules, **`plugin-failed`**, **`plugin-rule-undeclared`** |

Style patterns match the prose of the body and the title, description and summary (errors only
there). A warning pattern is reported once per text with its count. A significant number is an
amount, a percentage or a number from 1000 up, in the ruleset's notation; years, ages, small counts
and legal references ("art. 27", "section 401") need no source. Messages are English: they are read
by developers and by the agents that write the texts.

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
```

301 and 410 are answered before the page, in `proxy.ts` (Node.js runtime, Next 16):

```ts
import { createBlogRedirects } from "@softure-ai/blog/proxy";
const blogRedirects = createBlogRedirects(softureConfig);

export async function proxy(request: NextRequest) {
  return (await blogRedirects(request)) ?? NextResponse.next();
}
```

It handles GET and HEAD on the blog's text paths only, keeps the query on a redirect, remembers a
decision for 60 s (`ttlMs`) and passes a request on when the database fails. Import the styles after
ui's: `@import "@softure-ai/blog/styles.css";`. A data change shows after `revalidateSeconds`, or at
once with `revalidateTag(BLOG_CACHE_TAG)`. Custom OG fonts: an own `opengraph-image.tsx` calling `renderArticleOgImage({ title, label, brand, fonts })`.

The quality gate resolves internal links through `quality.paths` (default `/blog` and
`/blog/glossary`, the default routes); an app that moves `routes` sets `quality.paths` to match.

The commands:

```bash
softure-blog publish [<path>...] [--commit] [--withdraw] [--config <file>]
softure-blog check [<path>...] [--external] [--today <YYYY-MM-DD>] [--config <file>]
```

- `<path>` is a file or a folder (every `*.md` but `README.md`, by name); without one, `contentDir`.
- `--commit` writes; without it the command prints what it would do and writes nothing.
- `--withdraw` publishes the one given file as `withdrawn` (taking a text down at once); set the file's
  status too, or the next full publish brings the text back.
- Exit codes: 0 done, 1 refused or failed (nothing written), 2 usage error.

Output, one line per text, then a summary:

```text
added index-funds none -> published/index-funds
changed bonds draft/bonds -> published/bonds
moved bonds bond-basics -> bonds
summary: added 1, changed 1, unchanged 12
dry run: nothing written; pass --commit to write
```

Like `softure migrate`, the bin loads `softure.config.(ts|mts|js|mjs)` with Node and opens
`database.url`. When Node cannot load the config (path aliases, a bundled container), call
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

`check` needs no database. It reads the files (default: `contentDir`), resolves internal links against
the app's routes and the published texts of `contentDir`, and prints one line per finding:

```text
content/blog/index-funds.md:12: error [crucial] "crucial": a favourite word of language models; name what depends on the thing
content/blog/bonds.md: OK
check: 2 file(s), 1 error(s), 0 warning(s): red, do not publish
```

Exit codes: 0 green (warnings allowed), 1 an error, 2 usage error. `--external` also requests every
external link (HEAD, then GET when a server refuses HEAD; 2xx after redirects). Run it weekly with the
reusable workflow of this repository, `.github/workflows/blog-links.yml` (its header holds the
snippet for the app).

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
  toc: true, // or { maxLevel: 4 }; h2 and h3 by default
  messages: blogMessages.pl.render, // English by default
  blocks: [chartBlock],
  article: { currentAsOf: article.currentAsOf, fields: article.fields },
});
// body.html (null when a block returned a node), body.segments, body.headings, body.toc,
// body.linkedTerms, body.readingMinutes
```

- **Allowlist by construction:** raw HTML in the text is escaped, so the output holds only the
  elements Markdown produces. Images are off. Links keep `http(s)`, `mailto`, relative and `#`
  targets; any other scheme (`javascript:`, `data:`, entity-encoded or split by whitespace) stays text.
- **External links** (`http(s)` or `//` to a host outside `siteHosts`) get `rel="noopener noreferrer"`,
  `target="_blank"`, a `↗` marker hidden from screen readers and a visually hidden "(opens in a new tab)".
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
block. `findArticleBlocks(markdown, plugins)` lists the blocks a text uses with their line and
`requires`, without rendering. When any block returns a node, `html` is `null`: render `segments` in
order (`html` segments as HTML, `node` segments as they are).

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
"A slug is not in another article's history" stays in the code, under a row lock.

## 6. Environment variables

None of its own. The command reads the database URL from the app's config.

## 7. Switches

None.

## 8. Appearance

`styles.css` styles every `blog-*` class of the pages and of the rendered body (`blog-external`,
`blog-external-marker`, `blog-visually-hidden`, `blog-term`, `blog-toc`, `blog-footnote-ref`,
`blog-footnotes`, `blog-footnote-back`) with the `--sft-*` tokens of `@softure-ai/ui`, in the
`softure` layer, so the app's own rules win. The OG card takes `brand.colors`, else ui's dark theme.

## 9. Copy

`src/messages/`: labels of the kinds (`kinds.article`, `kinds.term`) and statuses (`statuses.*`) in
`en` and `pl`; the renderer's copy under `render.*` (notes heading, footnote label with `{number}`,
back to text, opens in a new tab, contents label), passed as `renderArticle({ messages })`; the pages'
copy under `pages.*`, `glossary.*`, `method.*`, `gone.*` (the 410 page) and `og.*`. Override any of it
with `blog({ messages: { pl: { pages: { readMore: "..." } } } })`. Command output and file errors are developer output, in English.

## 10. Hooks

- `blog({ fields })`: the app's frontmatter schema (FIRE_TRACKER's calculator scenario lives here).
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
- `renderArticle({ blocks })` and `blog({ blocks })`: block plugins for the app's fenced blocks
  (FIRE_TRACKER's engine chart).
- The pages' `cta` and `afterArticle` slots: the app's call to action and blocks (a waitlist form).

## 11. GDPR

Articles hold editorial content, no personal data: nothing to export or delete.

## 12. Limitations

- One publish at a time per article: concurrent runs take row locks, and a run that loses a slug race
  fails on the unique constraint instead of reporting `blog.slug_taken`.
- The content hash is part of the contract: a field added later enters it only when present.
- No `--stdin` (a deploy transport) and no IndexNow submit (BL-5).
- The pages' URLs (canonical, JSON-LD, OG) are built on `appOrigin`, not on the canonical host and
  trailing-slash rule of `@softure-ai/seo` (BF-7).
- The OG card uses the default font of `next/og`; an app passes `fonts` to `renderArticleOgImage` for another.
- The renderer has no images and no raw HTML. A plugin fence inside a list or a quote stays a code
  block (a block node cannot sit inside a list's HTML).
- The gate reads Markdown line by line (blocks, not a syntax tree): enough for the rules, not a
  renderer. Fenced code and HTML comments are skipped.
- **Adopting FIRE_TRACKER's gate:** `language: "pl"`, `ymyl: { ownCalculationMark }` with its calculation
  footnote's phrase, `voice.forbidFirstPersonSingular: true` plus its finance phrases, its domain as
  `ownOrigins`, `privateRouteSegments: ["api", "(app)"]`, and `rules-facts.ts` and `rules-chart.ts`
  as plugins (the package's tests hold stand-ins of both). Rule ids are English now (`kluczowy` →
  `crucial`, `myslniki` → `dashes`, …; the map is in the change archive), and the writing skill
  (BL-7) names them.
- **Adopting from FIRE_TRACKER:** rename the frontmatter keys once (`typ` → `kind` with `artykul` →
  `article` and `termin` → `term`, `formy` → `forms`, `klaster` → `cluster`, `filar` → `pillar`,
  `tytul` → `title`, `opis` → `description`, `w_skrocie` → `summary`, `aktualne_na` →
  `current_as_of`, `opublikowano` → `published_at`, `zrodla` → `sources` with `nazwa` → `name`,
  `faq` items `pytanie` → `question` and `odpowiedz` → `answer`), move `scenariusz` into the app's
  `fields`, and copy the rows into `blog.articles` with the hash the package computes from the renamed
  files, or the first publish marks every published text as updated.
