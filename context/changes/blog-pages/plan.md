# Plan: blog-pages

Input: change.md, research.md. Complexity: high (the widest surface of the roadmap: five pages, a proxy
piece, an OG image, a stylesheet, the example app, fixtures, e2e and CI).

## Goal

`@softure-ai/blog/next` ships the listing, article, glossary index, glossary term and method pages,
their metadata functions and the article OG image; `@softure-ai/blog/proxy` answers 301 and 410;
`@softure-ai/blog/styles.css` styles pages and rendered bodies on `--sft-*` tokens. The example app
mounts all of it with fixture articles and its e2e covers listing, article, glossary, 301 and 410.

**Out of scope:** "read next", RSS, sitemap entries, IndexNow (BL-5); quality rules (BL-6); images in
bodies (BF-3); FIRE's calculator CTA, topic illustrations and copy (stay in FIRE).

## Approach

**Chosen:** port FIRE's page logic (`blog-page.ts`, `blog-route.ts`, `blog-data.ts`) into pure
functions under `src/pages/` (no React, no Next: dates, crumbs, cluster groups, JSON-LD, path
decisions), server components under `src/ui/` that take ready data and messages (no Next imports, so
they render in tests with `react-dom/server`), and thin Next adapters under `src/next/` (config,
database, cache, `notFound`, metadata) and `src/proxy/`. Rejected: one Next-bound file per page as in
FIRE (untestable without Next), a config of CTA link and copy (research U1), marketing-kit templates
for the OG image (research U2).

**Key decisions:**

| Decision | Choice | Why |
| --- | --- | --- |
| Routes | manifest `routes: { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write" }`, overridable by `blog({ routes })`; article `${index}/${slug}`, term `${glossary}/${slug}` | research Q3 |
| Reserved slugs | a route one segment under `index` is reserved; `getReservedSlugs(config)` = `reservedSlugs` ∪ derived (method only with `methodPage: true`); the CLI passes it to the parser | research Q3 |
| New options | `brand?: { name, colors? }` (colours hex, defaults from ui `DEFAULT_THEME.dark`), `methodPage` (default `false`), `disclaimer?` (`{ en, pl? }` text), `clusters?` (label per cluster key, `{ en, pl? }`), `blocks?` (render plugins), `siteHosts?` (added to the `appOrigin` host), `revalidateSeconds` (default 300) | research, FIRE literals → options |
| Slots | `BlogArticlePage({ params, cta?, afterArticle? })`, `GlossaryTermPage({ params, cta? })`, `BlogIndexPage({ cta? })` | research U1 |
| Data | `src/next/data.ts`: `unstable_cache` per read (keys `softure-blog:*`, tag `softure-blog`, `revalidateSeconds`), `Date` revived | research Q2 |
| ISR | app files: article and term pages `export const revalidate = 300` and re-export `generateStaticParams` (`[]`); listing and glossary index `export const dynamic = "force-dynamic"` | research Q2 |
| Not found | unknown, draft, withdrawn or wrong-kind slug → `notFound()` (the proxy already answered 301/410) | FIRE |
| Proxy | `createBlogRedirects(config, { ttlMs = 60_000, maxEntries = 500 })` → `(request) => Promise<Response \| null>`; article path: withdrawn article → 410, term under article path → 301 to the term path, old slug → 301 (query kept); term path: withdrawn term → 410, old term slug → 301; failed lookup → `null`, not cached | research Q1, FIRE |
| 410 body | static HTML built from `messages.gone` (escaped), `lang` from the config, `noindex`, link to the listing | FIRE |
| JSON-LD | article `@graph`: `BlogPosting` (an `Article` subtype; dates = visible days, `image` = OG URL, `citation` from sources, brand as author and publisher when set), `BreadcrumbList`, `FAQPage` when FAQ; term `DefinedTerm` in `DefinedTermSet` + crumbs; glossary index `DefinedTermSet`; `<` escaped | FIRE |
| Dates | `getArticleDates(article, timezone)`; `formatDay(day, locale, timezone)` with `Intl.DateTimeFormat` | research Q6 |
| Metadata | `generate*Metadata` return title (`{title} — {brand}` via messages), description, canonical path, OG type `article` with `publishedTime`/`modifiedTime`, robots: empty listing and empty glossary `noindex` | FIRE |
| OG image | `BlogArticleOgImage({ params })` (default export target) + `renderArticleOgImage({ title, label, brand, fonts? })`, 1200×630 PNG, `next/og`; invisible slug → the blog's own card | research U2 |
| Styles | `styles.css` at the package root, exported `./styles.css`, `@layer softure`, only `var(--sft-*)`; test: no raw colour, every `blog-*` class used in `src/ui/` and by the renderer has a rule | research Q5 |
| Copy | `pages`, `glossary`, `method`, `gone`, `og` groups in `messages/{en,pl}.ts`; reading time with plural forms | AGENTS.md |
| Example app | `blog({ brand, methodPage: true, disclaimer, clusters })`, pages under `app/blog/**`, `<Waitlist placement="blog" />` under articles (placement added), a CTA to `/pricing`, `blog-redirects` first in `proxy.ts`, `npm run blog:publish`, e2e `blog.spec.ts` | research Q7 |

**Critical details:**
- `src/ui/` and `src/pages/` import nothing from `next/*` (ESLint rule and architecture test); only
  `src/next/` and `src/proxy/` do. `next/cache` and `next/og` get declarations in
  `src/next/next-modules.d.ts` like `next/navigation`.
- The rendered body: `segments` in order, `html` via `dangerouslySetInnerHTML` in a `div`, `node` as is;
  the renderer gets `glossary`, `termHref` from the glossary route, `siteHosts`, `blocks`, `toc: false`
  (the page builds its own contents list from `headings` of level 2, shown when there are two or more),
  `messages.render`, and `article: { currentAsOf, fields }`; a term page passes `selfSlug`.
- Term page "explained in these texts": published articles whose render `linkedTerms` include the term
  (same glossary, so the list matches the links).
- The proxy matches only the exact article and term path shapes (one kebab segment) and skips reserved
  slugs, so static pages never cost a query.
- `appOrigin` builds absolute URLs; seo's canonical host rule is not applied (gap for BL-5).

## Phase 1: pure page logic and options

**Discipline:** TDD. **Files:** `src/pages/{paths,dates,clusters,json-ld,redirects}.ts`, `src/pages/index.ts`,
`src/options.ts`, `src/index.ts`, `module.json`, `src/server/options.ts`, `src/cli/run.ts`,
`tests/pages-*.test.ts`.

1. Options (`brand`, `methodPage`, `disclaimer`, `clusters`, `blocks`, `siteHosts`, `revalidateSeconds`)
   and routes in the manifest and `module.json`; `getBlogRoutes`, `getBlogMessages`, `getReservedSlugs`.
2. Paths (article, term, reserved, parse a pathname into `{ kind, slug }`), dates, cluster groups and
   lead card, crumbs, JSON-LD builders, `decideBlogPath` and the cached decider, the 410 HTML.
3. The CLI passes `getReservedSlugs(config)`.

Done when FIRE's `blog-page.test.ts` and `blog-route.test.ts` cases pass in English against the
package functions.

## Phase 2: components, Next adapters, proxy, OG, styles, copy

**Discipline:** test-after. **Files:** `src/ui/*.tsx`, `src/next/*.ts(x)`, `src/proxy/index.ts`,
`styles.css`, `src/messages/{en,pl}.ts`, `package.json`, `tests/ui-*.test.tsx`, `tests/proxy.test.ts`,
`tests/styles.test.ts`, `tests/architecture.test.ts`.

1. Copy in both dictionaries.
2. Server components: listing (groups, lead card, cards, empty state), article (crumbs, dates, reading
   time, contents, summary, body segments, FAQ, sources, signature, method link, disclaimer, slots,
   JSON-LD), glossary index and term, method page, disclaimer.
3. Next adapters: context, cached data, five pages with `generate*Metadata` and
   `generateBlogStaticParams`, OG image; `./next`, `./proxy`, `./styles.css` exports; `next` and
   `react` as peers.
4. Proxy piece with a lookup over `findArticleBySlug` and `findSlugRedirect`.
5. Tests: components rendered with `react-dom/server` (FIRE's `blog-pages.test.tsx` cases), the proxy
   against PGlite, styles, architecture (no `next/*` in ui/pages, no raw colours, no inline copy).

Done when the gates are green and every page renders from PGlite rows in tests.

## Phase 3: example app and e2e

**Discipline:** test-after. **Files:** `examples/next-app/{softure.config.ts,proxy.ts,package.json,app/blog/**,content/blog/*.md,e2e/fixtures/blog-renamed/*.md,e2e/blog.spec.ts,scripts/blog.ts,scripts/e2e.mjs,app/layout.tsx,app/globals.css,messages/*.ts,README.md}`,
`examples/next-app/scripts/container.mjs`, `.github/workflows/e2e.yml`.

1. Enable `blog()` and the `blog` waitlist placement; mount the pages and the OG image; import the
   stylesheet; chain the proxy piece; publish script and fixtures.
2. e2e: listing groups and cards, article (dates, summary, FAQ, sources, JSON-LD, glossary link,
   slots), glossary index and term (with the linking article), method page, 301 (query kept), 410 for
   an article and for a term, 404 for a draft, OG image is a PNG.
3. CI and `scripts/e2e.mjs` run the publish step; the container check expects `blog: ok`.

Done when `npm run e2e` is green locally (Postgres 16, the cloud Chromium) and the module README
documents mounting.

## Risks and rollback

- Next statically reads segment config: `revalidate` and `dynamic` stay literals in the app's files
  (documented); a re-export would be ignored silently.
- The proxy queries the database on blog paths: the cache keeps it to one query per slug per minute,
  and a failure passes the request on (the page answers 404 or the article).
- Rollback: revert the merge; the tables and migrations are unchanged.

## Decisions (auto)

- CTA: a server component slot, not a config → research U1.
- OG image: `next/og` `ImageResponse`, not marketing-kit → research U2.
- `BlogPosting` for the article schema (an `Article` subtype, FIRE's choice).
- Term slugs get 301/410 from the proxy too (FIRE used a 308 from the page): one rule for both kinds.
- Cluster labels: an option per cluster key, else the key with dashes as spaces and a capital letter.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: pure page logic and options

#### Automated
- [ ] 1.1 Options, routes, reserved slugs; CLI passes them
- [ ] 1.2 Paths, dates, clusters, crumbs, JSON-LD, path decisions with FIRE's cases
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: components, Next adapters, proxy, OG, styles, copy

#### Automated
- [ ] 2.1 Copy in `en` and `pl`
- [ ] 2.2 Server components and their render tests
- [ ] 2.3 Next adapters, OG image, proxy piece, package exports
- [ ] 2.4 Stylesheet and architecture tests
- [ ] 2.5 Gates green (typecheck, lint, test, build)

### Phase 3: example app and e2e

#### Automated
- [ ] 3.1 Example app mounts the blog with fixtures
- [ ] 3.2 e2e for listing, article, glossary, method, 301, 410
- [ ] 3.3 CI, e2e script and container check updated; README
- [ ] 3.4 `npm run e2e` green locally
