# Research: blog-pages

Sources read: FIRE_TRACKER (read only, commit `15ec77e`) `src/app/blog/**` (hub, article, OG image,
glossary index and term, method page), `src/components/blog-article.tsx`, `blog-hub.tsx`,
`blog-glossary.tsx`, `blog-disclaimer.tsx`, `src/lib/blog-page.ts`, `blog-route.ts`, `blog-proxy.ts`,
`blog-paths.ts`, `blog-data.ts`, `src/proxy.ts` (blog part); SOFTURE `modules/blog/src/` (contract,
store, renderer, options), `modules/waitlist/src/next/`, `modules/billing/src/next/pages.tsx`,
`modules/seo/src/next/`, `foundation/core/src/module.ts` (routes and message overrides),
`foundation/ui` (tokens, compiled classes), `docs/02-module-standard.md` §8, `examples/next-app/`
(config, proxy, e2e harness, CI workflow, container check), Next 16.3.8 (`next/cache`, `next/og`).

## What FIRE does

| Part | FIRE | Behaviour |
| --- | --- | --- |
| Hub `/blog` | `force-dynamic`, data through `unstable_cache` (300 s) | groups by cluster (newest group first, no cluster last), pillar as a lead card, date and reading time per card; empty hub says "texts are coming" and is `noindex`. |
| Article `/blog/[slug]` | `revalidate = 300`, `generateStaticParams() → []` | crumbs, dates (published, updated unless same day, "current as of"), reading time, TOC of h2 when ≥ 2, "in short" box, body, FAQ, sources, signature, disclaimer, calculator CTA, related, account CTA, waitlist (`placement="blog"`); JSON-LD `@graph` of `BlogPosting` (dates equal to the visible ones), `BreadcrumbList`, `FAQPage`. A term slug under the article path → permanent redirect to the term page. |
| OG image | `opengraph-image.tsx`, `ImageResponse`, brand mark and FIRE fonts | the title on the brand's dark background; an invisible article gets the blog's own card, never a 404. |
| Glossary | index `force-dynamic`, term `revalidate = 300` | index sorted with `localeCompare(locale)`, `DefinedTermSet` JSON-LD; term page renders with `selfSlug`, lists articles that link the term (the renderer's `linkedTerms`), `DefinedTerm` + crumbs JSON-LD; an old term slug redirects (308 from the page). |
| 301 / 410 | `src/proxy.ts` → `blog-proxy.ts` → `blog-route.ts` | one segment under `/blog`, not reserved; current row wins over history; withdrawn article → 410 with a small static HTML page; old slug → 301 keeping the query; decisions cached per slug (60 s, 500 entries); a failed lookup is not cached and passes the request on. |
| Method page | static, FIRE copy (AI Act disclosure) | linked from every page footer and the disclaimer. |

FIRE-specific parts that become options or slots: the brand name and colours, the calculator CTA and
the account CTA (the app's CTA slot), the waitlist form (the slot under the article), the disclaimer
text (an app option per locale), the method page's content (message dictionaries the app overrides),
cluster labels (FIRE's map → a label derived from the key, overridable per cluster in options), card
illustrations (FIRE's topic art, not ported).

## Unknowns

**U1. How the app passes its CTA.** A server component slot. The pages take `cta` and `afterArticle`
props (`ReactNode`); a mount with no slots stays a one-line re-export, a mount with slots is a
three-line page that renders `<BlogArticlePage {...props} cta={<AppCta />} afterArticle={<Waitlist
placement="blog" />} />`. A config of link and copy cannot express FIRE's CTA (scenario in the link,
two buttons, a form) and would make the blog depend on the waitlist package. With a slot the blog does
not import `@softure-ai/waitlist` at all; "when enabled" is the app's choice of what to put there.

**U2. OG image: marketing-kit or `ImageResponse`.** `ImageResponse` from `next/og`. marketing-kit is a
dev-time tool (`tools/marketing-kit`, Playwright and its own templates), not a runtime dependency a
page can call; `next/og` ships with Next (Satori + resvg, Geist as the default font, missing glyphs
fetched by Satori). The card takes the brand name and three colours from `blog({ brand })`, defaulting
to the dark scheme of `@softure-ai/ui`'s `DEFAULT_THEME`. An app with its own fonts calls the exported
`renderArticleOgImage({ title, brand, fonts })` from its own `opengraph-image.tsx`.

## Questions the port raises

**Q1. Where 301 and 410 happen.** In the proxy, as in FIRE: `next/navigation` has no 410, and
`permanentRedirect` answers 308. The package adds a `@softure-ai/blog/proxy` entry (the ID-3 pattern
of `@softure-ai/auth/proxy`): `createBlogRedirects(config)` returns `(request: Request) =>
Promise<Response | null>`; Next 16 runs `proxy.ts` on Node.js, so it can query Postgres through
`getSharedDatabase`. It covers the article path and the term path the same way (FIRE redirected term
slugs from the page with 308), and an article path that names a term (301 to the term page). Async,
unlike the auth guard, so the app awaits it first: `(await blogRedirects(request)) ?? …`.

**Q2. ISR without a database at build time.** Article and term pages: `revalidate` (a literal in the
app's page file, Next reads it statically) and `generateStaticParams() → []` re-exported from the
package; the first request renders and caches. Listing and glossary index have no params, would be
prerendered at build and fail without a database, so they are `force-dynamic` (literal in the app
file) and read through `unstable_cache` with the same revalidation, as FIRE. `unstable_cache` stores
JSON, so `Date` fields come back as strings and are revived (FIRE's bug fix, kept).

**Q3. Paths.** Module routes (`blog({ routes })`, core merges overrides): `index` `/blog`, `glossary`
`/blog/glossary`, `method` `/blog/how-we-write`. Article path `${index}/${slug}`, term path
`${glossary}/${slug}` (also the renderer's `termHref`). A route that is one segment under `index`
reserves that segment for article slugs: the publish command refuses it together with
`reservedSlugs`. The method page is optional (`blog({ methodPage: true })`); without it no page links
to it and its slug is not reserved.

**Q4. Absolute URLs.** JSON-LD needs absolute URLs; the pages build them on `config.appOrigin`, and
metadata uses relative paths resolved by the app's `metadataBase`. `@softure-ai/seo`'s canonical host
rule (apex/www, trailing slash) is not applied by the blog: a gap for BL-5, which connects the two
modules anyway.

**Q5. Styling.** Module markup may only use `sft:` classes that `@softure-ai/ui` already compiles
(architecture tests), and that set has no typography for long text. The blog ships its own stylesheet,
`@softure-ai/blog/styles.css`: plain CSS on `var(--sft-*)` tokens in `@layer softure`, for the page
parts (`blog-card`, `blog-summary`, …) and the renderer's classes (`blog-toc`, `blog-term`,
`blog-external-marker`, `blog-visually-hidden`, footnotes). A test keeps raw colours out of it.

**Q6. Dates.** Days are shown and put in JSON-LD in `config.timezone`; "updated" is hidden when it falls
on the publication day (FIRE). Formatting with `Intl.DateTimeFormat(config.locale, { dateStyle:
"long", timeZone })`; `current_as_of` is already a day.

**Q7. The example app and e2e.** The app enables `blog()`, keeps fixture files in `content/blog/`
(two articles in a cluster, one with FAQ and sources, a term, a withdrawn article) and a renamed
article whose old slug is in the history. A script `npm run blog:publish` (via `runBlogCli`) publishes
the files; the e2e workflow and `scripts/e2e.mjs` run it after `migrate`. The rename fixture is
published first under its old slug from `e2e/fixtures/blog-renamed/`, then under the new slug from
`content/blog/`, so the end state is the same on every run. The container check lists `blog: ok`
among the health checks (the module has a health check).
