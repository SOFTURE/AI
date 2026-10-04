# @softure-ai/blog

Articles and glossary terms kept as Markdown files in the app's repository, and a publish command that
brings the module's tables to the state of those files. The files are the source of truth: there is no
editor and no CMS, a text changes only through a commit and `softure-blog publish`.

This release holds the content store (roadmap item BL-2) and the server-side renderer (BL-3). The
pages (BL-4), RSS, sitemap and IndexNow (BL-5) and the quality gate (BL-6) build on them.

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

## 2. Installation

```bash
npm install @softure-ai/blog
```

Then add `blog()` to the modules of `softure.config.ts` and run `softure migrate`.

## 3. Configuration

```ts
import { blog } from "@softure-ai/blog";
import { z } from "zod";

blog({
  // The folder `softure-blog publish` reads when no path is given. Default: "content/blog".
  contentDir: "content/blog",
  // Slugs taken by the blog's static pages (a glossary index, a method page). Default: none.
  reservedSlugs: ["glossary"],
  // The app's own frontmatter keys, checked by the app's schema. Default: none.
  fields: z.object({ scenario: z.string().regex(/^[a-z]=\d+(&[a-z]=\d+)*$/).optional() }),
});
```

`fields` may not reuse a key of the module (`FRONTMATTER_KEYS`). Its parsed value is stored in
`articles.fields`, enters the content hash and must be plain JSON.

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

Nothing yet: the pages arrive with BL-4. The command:

```bash
softure-blog publish [<path>...] [--commit] [--withdraw] [--config <file>]
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

`runBlogCli({ gate })` takes the quality gate (BL-6) for files going public; `runBlogPublish` in
`@softure-ai/blog/server` is the same run without a command line.

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

No components yet (BL-4). The rendered body uses these classes for the app's styles:
`blog-external`, `blog-external-marker`, `blog-visually-hidden` (must hide visually, keep for screen
readers), `blog-term`, `blog-toc`, `blog-footnote-ref`, `blog-footnotes`, `blog-footnote-back`.

## 9. Copy

`src/messages/`: labels of the kinds (`kinds.article`, `kinds.term`) and statuses (`statuses.*`) in
`en` and `pl`; the renderer's copy under `render.*` (notes heading, footnote label with `{number}`,
back to text, opens in a new tab, contents label), passed as `renderArticle({ messages })`. Command output and file errors are developer output, in English.

## 10. Hooks

- `blog({ fields })`: the app's frontmatter schema (FIRE_TRACKER's calculator scenario lives here).
- `gate` of `runBlogPublish` and `runBlogCli`: `(file, article) => problems`, called only for files
  going public; any problem refuses the whole run.
- `renderArticle({ blocks })`: block plugins for the app's fenced blocks (FIRE_TRACKER's engine chart).

## 11. GDPR

Articles hold editorial content, no personal data: nothing to export or delete.

## 12. Limitations

- One publish at a time per article: concurrent runs take row locks, and a run that loses a slug race
  fails on the unique constraint instead of reporting `blog.slug_taken`.
- The content hash is part of the contract: a field added later enters it only when present.
- No `--stdin` (a deploy transport) and no IndexNow submit (BL-5).
- The renderer has no images and no raw HTML. A plugin fence inside a list or a quote stays a code
  block (a block node cannot sit inside a list's HTML).
- **Adopting from FIRE_TRACKER:** rename the frontmatter keys once (`typ` → `kind` with `artykul` →
  `article` and `termin` → `term`, `formy` → `forms`, `klaster` → `cluster`, `filar` → `pillar`,
  `tytul` → `title`, `opis` → `description`, `w_skrocie` → `summary`, `aktualne_na` →
  `current_as_of`, `opublikowano` → `published_at`, `zrodla` → `sources` with `nazwa` → `name`,
  `faq` items `pytanie` → `question` and `odpowiedz` → `answer`), move `scenariusz` into the app's
  `fields`, and copy the rows into `blog.articles` with the hash the package computes from the renamed
  files, or the first publish marks every published text as updated.
