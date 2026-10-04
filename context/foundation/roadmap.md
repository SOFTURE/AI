---
project: "SOFTURE AI"
roadmap: blog
version: 1
status: ready
prd_version: 2
created: 2026-10-04
updated: 2026-10-04
backlog: context/backlog/roadmap-blog/
---

# Roadmap blog: a Markdown blog with SEO, AI crawler access and a text quality gate

> Reference: [`docs/06-fire-extraction-2.md`](../../docs/06-fire-extraction-2.md) (what FIRE_TRACKER's blog gives,
> file by file, and what stays in FIRE as plugins), PRD v2 FR-27…FR-30.
>
> Entries: [`context/backlog/roadmap-blog/`](../backlog/roadmap-blog/). An entry is taken (moved to
> `context/changes/<id>/`) when its item starts.
>
> Written and promoted by the owner on 2026-10-04 from the second FIRE_TRACKER analysis, with no main roadmap in
> flight (followups closed earlier the same day). Two more roadmaps from the same analysis are queued:
> [`charts`](roadmaps/roadmap-charts.md) and [`deploy`](roadmaps/roadmap-deploy.md).
>
> Gaps found while delivering this roadmap go to its catch-all, the queued roadmap
> [`blog-followups`](roadmaps/roadmap-blog-followups.md) (owner, 2026-10-03: gaps are collected, not fixed on the
> spot): a new gap gets the next `BF-` number, a backlog entry and a row.
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Process: every item runs the full softure chain (new → research → frame → plan → plan review → implement →
>   impl review → archive); skipping research or framing is justified in `change.md` (owner, 2026-10-03).
> - Owner at the keyboard: BL-8 only (first npm publishes).
>
> FIRE_TRACKER (owner, 2026-10-03): read only. Items copy its code; none changes it. Domain parts (the engine chart
> block, the facts rules, the calculator scenario) stay in FIRE as plugins of the module; FIRE adopts the module in
> its own roadmap.
>
> Queued after this one (WORKFLOW §5.1, files in `roadmaps/`, entries in `context/backlog/`):
> 1. [`roadmap-blog-followups`](roadmaps/roadmap-blog-followups.md): gaps found while delivering this roadmap.
> 2. [`roadmap-charts`](roadmaps/roadmap-charts.md): SVG chart primitives with accessibility guards.
> 3. [`roadmap-deploy`](roadmaps/roadmap-deploy.md): the deploy package, reusable workflows and test tools.
> 4. [`roadmap-later`](roadmaps/roadmap-later.md): items parked until an owner step is done.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **BL-1** | `seo-crawler-access` | `@softure-ai/seo`: `robots` with explicit AI crawler lists, `htmlLimitedBots` that keeps Next's defaults, sitemap builder, canonical host, IndexNow key and submit | — | autonomous | done_code (2026-10-04; waiting: first npm release of @softure-ai/seo, BL-8) |
| **BL-2** | `blog-content-store` | `@softure-ai/blog`: article and term tables in the module's schema, Markdown files with a strict frontmatter, `softure-blog publish` (dry run by default), slug history | — | autonomous | done_code (2026-10-04; waiting: the first release of `@softure-ai/blog`, BL-8) |
| **BL-3** | `blog-markdown-renderer` | server-side Markdown renderer with an allowlist, heading anchors, glossary auto-links from term forms and a block plugin API | BL-2 | autonomous | ready |
| **BL-4** | `blog-pages` | `/blog`, article and glossary pages from the package: ISR, JSON-LD, summary box, sources, disclaimer and CTA slots, 301/410, OG image per article | BL-3 | autonomous | ready |
| **BL-5** | `blog-discovery` | RSS feed, blog sitemap entries with a real `lastmod`, IndexNow ping on publish, "read next" by cluster with the pillar first | BL-1, BL-4 | autonomous | ready |
| **BL-6** | `blog-quality-gate` | `softure-blog check`: structure, links, style and YMYL rules with language rulesets and rule plugins; publish refuses errors | BL-2 | autonomous | ready |
| **BL-7** | `blog-writing-skill` | a writing skill shipped with the blog module and installed into the app, kept in sync with the gate's rules | BL-6 | autonomous | ready |
| **BL-8** | `blog-release` | `@softure-ai/seo` and `@softure-ai/blog` 0.1.0 published through the release pipeline; READMEs, adoption guides and docs updated | BL-1…BL-7 | owner | blocked (waits for BL-1…BL-7 and the owner's first npm publish at the keyboard) |

## Order

Lanes follow file ownership: items in one lane share files, so they run one after another; different lanes run in
parallel, up to 4 at once.

| Lane | Items, in order | Shared files |
| --- | --- | --- |
| A: seo | BL-1 | `modules/seo/` |
| B: blog core | BL-2 → BL-3 → BL-4 → BL-5 | `modules/blog/` (`src/content/`, `src/db/`, `src/render/`, `src/next/`, `src/discovery/`), its migrations |
| C: quality | BL-6 → BL-7 (after BL-2) | `modules/blog/src/quality/`, `modules/blog/skill/` |

1. **First wave: BL-1 and BL-2.** BL-2 fixes the contract (tables, file format, publish CLI) that every other blog
   item builds on; BL-1 needs nothing and BL-5 waits for it.
2. **After BL-2:** BL-3 (lane B) and BL-6 (lane C) in parallel. BL-6 touches only `src/quality/` and the publish
   gate's hook; BL-2 leaves that hook as a no-op.
3. **Each free slot** takes the first item of this list whose lane is idle and whose dependencies are on `master`:
   BL-3, BL-6, BL-4, BL-7, BL-5.
4. **BL-8** (owner) once BL-1…BL-7 are merged.

The example app (`examples/next-app/`) is touched by BL-1, BL-4 and BL-5; `master` is the source of truth and each
thread merges it and resolves the conflicts itself.

Risk first: BL-2 proves the content contract on PGlite; BL-3 is the security boundary (stored XSS) and gets XSS
fixtures before the pages exist.

## Owner at the keyboard?

Assessed on 2026-10-04 against what a cloud session cannot do: secrets, provider accounts, paid API calls, the
owner's own machine, a product decision only the owner can make, or a change in FIRE_TRACKER.

| ID | Needs the owner | Why |
| --- | --- | --- |
| BL-1 | no | pure functions and routes; IndexNow submit is a dry run in tests, the key is public by protocol |
| BL-2 | no | migrations and a CLI tested on PGlite and the local Postgres |
| BL-3 | no | a server renderer with unit and XSS fixture tests |
| BL-4 | no | pages in the example app with fixture articles; e2e in CI |
| BL-5 | no | RSS, sitemap contributor and a dry-run IndexNow submit |
| BL-6 | no | rules ported with FIRE's fixtures; external links only in the weekly workflow on GitHub's runners |
| BL-7 | no | a skill file and a sync test |
| BL-8 | yes | first (staged) npm publish and trusted publisher on npmjs.com are the owner's steps |

## Items

### BL-1: SEO and AI crawler access
- **Change ID:** `seo-crawler-access`
- **Status:** done_code (2026-10-04; waiting: first npm release of @softure-ai/seo, BL-8)
- **Input:** [`context/archive/2026-10-04-seo-crawler-access/change.md`](../archive/2026-10-04-seo-crawler-access/change.md)
- **Outcome:** A new module `@softure-ai/seo` (`modules/seo/`, copied from `templates/package/`, no database) that any app uses with or without the blog:
  - `buildRobots(config)`: explicit allow lists for AI crawlers in three categories (search, on-demand fetchers, training), each switchable off as one list; private paths disallowed for everyone;
  - `buildHtmlLimitedBots(extra)`: extends Next's default `htmlLimitedBots` instead of replacing it, with a guard test that compares the copied default with the installed Next;
  - `buildSitemap(contributors)`: entries from app and module contributors with a real `lastmod`, never the build time;
  - canonical host helper (apex vs `www`, trailing slash) for `metadata.alternates.canonical`;
  - IndexNow: the public key file route and `submitToIndexNow(urls)` with a dry run by default and no network in tests.

  The example app serves `robots.txt`, `sitemap.xml` and the key file, covered by an e2e.
- **Prerequisites:** none (roadmap trigger).
- **Unknowns:**
  - Where the IndexNow key lives: app config (public by protocol) vs. an environment variable.
  - Whether the crawler lists ship as data the app can extend without a release (a list update is not a breaking change).
- **Risk:** low. About 500 LOC in FIRE, no domain code.
- **Baseline:** FIRE `src/lib/{ai-crawlers,indexnow}.ts`, `src/app/{robots,sitemap}.ts` with their tests. After: the same behaviour from the package, FIRE literals (host, key, paths) in config only.
- **PRD refs:** FR-27, NFR-1, NFR-5.
- **Source (FIRE_TRACKER, read only):** `src/lib/ai-crawlers.ts`, `src/lib/indexnow.ts` (key and submit part), `src/app/robots.ts`, `src/app/sitemap.ts`, `next.config.ts` (`htmlLimitedBots`)

### BL-2: Blog content store and publish script
- **Change ID:** `blog-content-store`
- **Status:** done_code (2026-10-04; waiting: the first release of `@softure-ai/blog`, BL-8)
- **Input:** [`context/archive/2026-10-04-blog-content-store/`](../archive/2026-10-04-blog-content-store/change.md)
- **Outcome:** A new module `@softure-ai/blog` (`modules/blog/`, copied from `templates/package/`) with its own schema and forward-only migrations:
  - `articles` (kind `article` or `term`, status `draft`/`published`/`withdrawn`, summary, sources, FAQ, term forms, cluster and pillar flag, `current_as_of`, content hash) and `slug_history`;
  - database constraints for every invariant that can be one (a published article has a date, slugs unique, statuses closed);
  - the article file format: Markdown with a YAML frontmatter validated by a strict zod schema (English keys, unknown key is an error), extendable by an app plugin schema for domain fields (FIRE's calculator scenario stays in FIRE);
  - `softure-blog publish <dir>`: dry run by default, `--commit` writes; content hash skips unchanged files; a slug change records the old slug; one pillar per cluster checked over the whole directory;
  - `getPublishedArticle`, `listArticles` and friends as read functions for the pages (BL-4).
- **Prerequisites:** none (roadmap trigger).
- **Unknowns:**
  - Whether FIRE's Polish frontmatter keys get an alias map for adoption or a one-off file rename in FIRE's own roadmap.
  - Where an app keeps its articles by default (`content/blog/`) and how the CLI finds the database (`DATABASE_URL`, like `softure migrate`).
- **Risk:** medium. The contract every later blog item builds on.
- **Baseline:** FIRE `src/db/blog.ts`, `src/db/blog-publish.ts`, `src/lib/blog-article-file.ts`, `scripts/blog-publikuj.ts` and migrations 0050–0053 with their tests. After: the same tests green in the package on PGlite, zero FIRE literals in `src/`.
- **PRD refs:** FR-28, NFR-2, NFR-4.
- **Source (FIRE_TRACKER, read only):** `src/db/blog.ts`, `src/db/blog-publish.ts`, `src/db/blog-transport.ts`, `src/lib/blog-article-file.ts`, `src/lib/blog-paths.ts`, `scripts/blog-publikuj.ts`, `drizzle/0050`–`0053`

### BL-3: Safe Markdown renderer with glossary links
- **Change ID:** `blog-markdown-renderer`
- **Status:** ready
- **Outcome:** `renderArticle(markdown, options)` in `@softure-ai/blog` renders on the server only:
  - an element allowlist, no raw HTML, external links with `rel="noopener noreferrer"` and an external marker;
  - heading ids and an optional table of contents;
  - glossary auto-links: the first mention of a term form links to its definition, never inside headings or links;
  - a block plugin API (a fenced block type → a server component or HTML) so domain blocks stay in the app (FIRE's engine chart becomes a plugin);
  - reading time.
- **Prerequisites:** BL-2.
- **Unknowns:**
  - Which Markdown parser (FIRE's choice vs. a smaller one) keeps the allowlist simple and the bundle server-only.
  - How a block plugin declares its frontmatter needs, so the quality gate (BL-6) can check them.
- **Risk:** medium. A renderer is a security boundary (stored XSS).
- **Baseline:** FIRE `src/lib/blog-markdown.ts`, `src/lib/blog-glossary.ts` and their tests. After: the same cases plus XSS fixtures green in the package; FIRE's chart block renders through the plugin API in a test fixture.
- **PRD refs:** FR-29, NFR-5.
- **Source (FIRE_TRACKER, read only):** `src/lib/blog-markdown.ts`, `src/lib/blog-glossary.ts`, `src/lib/blog-chart-html.ts` (only as the plugin example)

### BL-4: Blog pages
- **Change ID:** `blog-pages`
- **Status:** ready
- **Outcome:** Pages and route handlers shipped from `@softure-ai/blog` (the ID-1 pattern), mounted by the app under a configurable base path:
  - listing with cards, article page and glossary pages, rendered with ISR;
  - JSON-LD (`Article`, `FAQPage`, `DefinedTerm`), summary box, published and updated dates, sources, an optional disclaimer;
  - slots for the app: a CTA component and the waitlist sign-up under the article (`@softure-ai/waitlist` placement `blog` when enabled);
  - 301 from slug history, 410 for withdrawn articles;
  - an OG image per article through Next's `opengraph-image` with the brand from config;
  - an optional "how our texts are made" page;
  - every visible string in `pl` and `en` dictionaries; styling with `--sft-*` tokens.

  The example app mounts the blog with fixture articles; e2e covers listing, article, glossary, 301 and 410.
- **Prerequisites:** BL-3 (and BL-2 through it).
- **Unknowns:**
  - How the app passes its CTA (a server component slot vs. a config of link and copy).
  - Whether the OG image reuses marketing-kit's Satori templates or stays on Next's `ImageResponse`.
- **Risk:** medium. The widest surface: routing, metadata, example app and e2e.
- **Baseline:** FIRE `src/app/blog/**`, `src/lib/blog-page.ts`, `src/lib/blog-route.ts`, `src/lib/blog-proxy.ts` and their tests. After: the example app serves the blog, e2e green, no FIRE copy outside dictionaries.
- **PRD refs:** FR-29, FR-9, NFR-3, NFR-6.
- **Source (FIRE_TRACKER, read only):** `src/app/blog/**`, `src/lib/blog-page.ts`, `src/lib/blog-route.ts`, `src/lib/blog-proxy.ts`, `src/lib/blog-data.ts`

### BL-5: Blog discovery: RSS, sitemap and IndexNow
- **Change ID:** `blog-discovery`
- **Status:** ready
- **Outcome:**
  - an RSS 2.0 feed route for published articles;
  - a sitemap contributor for `@softure-ai/seo` (BL-1) with each article's real `lastmod`;
  - `softure-blog publish --commit` submits the changed paths (article, old slug, hub, glossary) through IndexNow, dry run without the flag;
  - "read next" under an article: same cluster first, the pillar on top, then the newest.
- **Prerequisites:** BL-1, BL-4.
- **Unknowns:** Whether the IndexNow submit runs in the CLI only or also as a function the app can call after its own publishing path.
- **Risk:** low.
- **Baseline:** FIRE `src/lib/blog-discovery.ts`, `src/lib/indexnow.ts` (changed paths part), `src/app/blog/rss.xml/route.ts` and their tests. After: the same tests green in the package; the example app's feed and sitemap include the fixture articles (e2e).
- **PRD refs:** FR-27, FR-29.
- **Source (FIRE_TRACKER, read only):** `src/lib/blog-discovery.ts`, `src/lib/indexnow.ts`, `src/app/blog/rss.xml/route.ts`, `src/app/sitemap.ts` (blog part)

### BL-6: Text quality gate
- **Change ID:** `blog-quality-gate`
- **Status:** ready
- **Outcome:** A quality gate in `@softure-ai/blog` that runs before every publish and in CI:
  - structure rules (answer first, heading order, length, summary present);
  - link rules (internal targets exist, glossary terms resolve; external links checked only with `--external`);
  - style rules from a ruleset chosen by the app: language (`pl` ruleset ported from FIRE, an `en` ruleset), AI-writing patterns, brand voice phrases from config;
  - YMYL rules (a number needs a source, `current_as_of` required), switchable per app;
  - a rule plugin API: FIRE's domain rules (`rules-facts`, `rules-chart`) stay in FIRE as plugins;
  - findings with severity and file position; `softure-blog check` exits non-zero on errors, and `publish` refuses them;
  - a reusable weekly workflow that runs the gate with `--external`.
- **Prerequisites:** BL-2.
- **Unknowns:**
  - How much of FIRE's Polish style list is generic Polish and how much is FIRE's voice (the latter goes to config).
  - Whether rule messages are English only (developer output) or come from dictionaries (shown to editors).
- **Risk:** medium. Texts go to production without a human read; a weak gate ships bad copy.
- **Baseline:** FIRE `src/lib/blog/quality/**` (fixtures and tests), `scripts/blog-check.mts`, `.github/workflows/blog-links.yml`. After: the same fixtures give the same findings through the `pl` ruleset plus FIRE's plugins in a test.
- **PRD refs:** FR-30.
- **Source (FIRE_TRACKER, read only):** `src/lib/blog/quality/**`, `scripts/blog-check.mts`, `.github/workflows/blog-links.yml`

### BL-7: Article writing skill
- **Change ID:** `blog-writing-skill`
- **Status:** ready
- **Outcome:**
  - a skill (`SKILL.md` plus references) in `@softure-ai/blog` that walks an agent through writing an article: brief, sources, structure, frontmatter, the gate, publish;
  - `softure-blog skill install` copies it into the app's `.claude/skills/`, filled from the app's ruleset and voice;
  - a sync test: every rule the gate enforces is named in the skill, and the skill names no rule the gate lacks.
- **Prerequisites:** BL-6.
- **Unknowns:** Whether the skill belongs in `@softure-ai/skills` (the external workflow package) instead; default: ship it with the blog module, since it depends on the module's rules.
- **Risk:** low.
- **Baseline:** FIRE `.claude/skills/blog-pisz/` and `src/lib/blog/quality/skill-sync.test.ts`. After: the skill installs into the example app and the sync test is green.
- **PRD refs:** FR-30, NFR-6.
- **Source (FIRE_TRACKER, read only):** `.claude/skills/blog-pisz/`, `src/lib/blog/quality/skill-sync.test.ts`

### BL-8: SEO and blog release
- **Change ID:** `blog-release`
- **Status:** blocked (waits for BL-1…BL-7 and the owner's first npm publish at the keyboard)
- **Outcome:** `@softure-ai/seo` and `@softure-ai/blog` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); module READMEs with an adoption guide for FIRE_TRACKER (its blog plugins: engine chart, facts rules, calculator scenario); a finish review across BL-1…BL-7.
- **Prerequisites:** BL-1…BL-7.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, FR-26, G-4.

## Before the next release

- [ ] `@softure-ai/seo` and `@softure-ai/blog` enter the release pipeline's package list (**BL-8**).

## Owner decisions and checks

- [ ] **BL-8**: approve the first (staged) publish of `@softure-ai/seo` and `@softure-ai/blog` on npmjs.com, then add
  a trusted publisher for each.

## Done

- **BL-2** `blog-content-store`: `@softure-ai/blog` keeps articles and glossary terms in `blog.articles` and `blog.slug_history` (migration `0001`; every row invariant a constraint, one pillar per cluster as an exclusion deferred to commit); article files are Markdown with a strict English YAML frontmatter plus the app's own `fields`; `softure-blog publish` is a dry run by default and all or nothing with `--commit`, skips unchanged files by content hash, keeps old slugs as redirects and takes a quality gate hook (BL-6); reads for the pages: `getPublishedArticle`, `findArticleBySlug`, `findSlugRedirect`, `listArticles`; gaps BF-1 and BF-2; archived in `archive/2026-10-04-blog-content-store/`
- **BL-1** `seo-crawler-access`: `@softure-ai/seo` with robots and AI crawler lists, `htmlLimitedBots`, sitemap contributors, canonical URLs and IndexNow (dry run by default); the example app serves robots, sitemap and the key file under an e2e; archived in `archive/2026-10-04-seo-crawler-access/`
