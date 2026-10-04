# Research: blog-discovery

Sources read: FIRE_TRACKER (read only, commit `15ec77e`) `src/lib/blog-discovery.ts` and its test,
`src/lib/indexnow.ts` and its test, `src/app/blog/rss.xml/route.ts` and its test, `src/app/sitemap.ts`
(blog part), `scripts/blog-publikuj.ts` (the `--indexnow` part), `src/components/blog-article.tsx`
("read next"), `src/app/blog/page.tsx` and `[slug]/page.tsx` (feed links); SOFTURE
`modules/seo/src/` (`sitemap.ts`, `settings.ts`, `next/`, `server/indexnow.ts`),
`modules/blog/src/` (`db/publish-run.ts`, `cli/run.ts`, `next/`, `pages/paths.ts`, `ui/blog-article.tsx`),
`foundation/core/src/config.ts` (optional `dependsOn`), `modules/auth/package.json` (optional peer
`@softure-ai/mailing`), `examples/next-app/` (config, `app/sitemap.ts`, `scripts/blog.ts`,
`blog:fixtures`, `e2e/seo.spec.ts`, `e2e/blog.spec.ts`).

## What FIRE does

| Part | FIRE | Behaviour |
| --- | --- | --- |
| `lastmod` | `getArticleLastModified` | `updatedAt ?? publishedAt`; `updatedAt` moves only when the content hash changes (BL-2), so it is a date a search engine can trust. |
| Sitemap | `getBlogSitemapEntries(articles, terms)` | hub `/blog` (0.7, lastmod = newest text) and articles (pillar 0.7, other 0.6) only when there is an article; glossary hub and terms (0.5) only when there is a term: an empty hub is `noindex`, and a sitemap must not list it. The method page is a static entry without a date. A read failure leaves the blog out, not the whole sitemap. |
| RSS | `buildBlogRss(articles, origin, terms)` | RSS 2.0 with `atom:link rel="self"`; channel title `Blog — <brand>`, link to the hub, description, language, `lastBuildDate` = newest change (absent when empty). Items: title, link, `guid isPermaLink="false"` = article id (survives a slug change), description, `pubDate`, category = cluster label or the glossary title. **No body**: the reader goes to the page with sources and disclaimer. Articles and terms together, newest publication first. XML escaped (`& < > " '`). |
| Feed route | `GET /blog/rss.xml` | `force-dynamic` over the cached reads; a read failure is **503** with `retry-after`, never an empty feed (a reader would think the texts were deleted). |
| Feed links | listing and article metadata | `alternates.types["application/rss+xml"] = [{ url, title }]`. |
| Read next | `getRelatedArticles(article, published)` | Satellite: pillar of its cluster, rest of the cluster, then pillars and the newest of other clusters; 4 in total. Pillar: every satellite of its cluster (up to 6, even above 4), filled to 4 from other clusters. No cluster: pillars, then the newest. Never itself. |
| IndexNow paths | `getIndexNowPaths(changes)` | Skip `unchanged` and texts public neither before nor after. Otherwise: the text's path, its old slug when it was public (now a 301), and the hub of its kind (`/blog` or the glossary). Texts first, hubs after, no repeats. |
| Submit | `scripts/blog-publikuj.ts --indexnow` | After a successful run: nothing to submit → a line; a dry run → the paths it would send; a commit → `submitToIndexNow`; a failure is a value and never changes the exit code. |

FIRE-only, not carried over: the calculator's reading list (`getCalculatorReading`), the Polish copy and
brand constants, the hard-coded `/blog` paths.

## The unknown: CLI only, or also a function?

**Both.** The pure part (`getIndexNowPaths(changes, routes)`) and the submit
(`submitBlogChanges(config, changes, { commit })`) live in `src/discovery/`; the CLI calls the submit
after a publish run, and `@softure-ai/blog/server` exports both so an app with its own publishing path
(an admin action calling `runBlogPublish`) submits the same addresses. Inside Next that path should
`revalidateTag("softure-blog")` before the submit, so a crawler that comes at once sees the new text;
the README says so.

## Questions the port raises

**Q1. How does blog reach seo without depending on it?** `@softure-ai/seo` becomes an optional peer
dependency of `@softure-ai/blog` (the `auth` → `mailing` pattern) and an optional module dependency
(`dependsOn: { seo: "^0.0.0?" }`, supported by core's config check: listed → version checked and placed
first; not listed → fine). The CLI imports `@softure-ai/seo/server` **dynamically** and only when the
config lists `seo()`, so an app without the package still runs `softure-blog`. The settings come from
seo's root entry (`resolveSeoSettings`, pure), not from `@softure-ai/seo/next` (`getSeoSettings` there
reads the request-scope registry by default and pulls `@softure-ai/core/next` into a CLI). The
sitemap contributor needs no seo import at all: `SitemapContributor` is structural (`{ siteOrigin }` in,
`{ path, lastModified, priority }[]` out), so the blog writes the same shape.

**Q2. Which origin does each URL use?** The sitemap and IndexNow take **paths**; seo makes them absolute
on its `siteOrigin` with its canonical rule, so both already follow the seo rule. The feed needs
absolute links in its XML; it uses `appOrigin`, the origin every blog page's canonical uses today, so a
feed link and the page's canonical never disagree. Moving all blog URLs to the seo rule is BF-7.

**Q3. Where does the contributor read from?** From the cached reads of `src/next/data.ts` (one query per
`revalidateSeconds`, tag `softure-blog`), like the pages. It takes the config lazily
(`getSoftureConfig()` at call time), because the contributor is created while the config is still
being defined. *Updated in implementation:* `softure.config.ts` also loads in plain Node and in bundles made outside Next (`softure migrate`, the blog command, the container's esbuild migrate script), where nothing may reach `next/*`. So `blogSitemap()` lives in the root entry and reads with one `listArticles` query on the shared database instead of the Next cache; a sitemap is read rarely. A read failure throws, and
seo's `buildSitemap` logs it and leaves the blog out, as FIRE did.

**Q4. Feed path.** A new module route `rss: "/blog/rss.xml"` (overridable like the others); the proxy
piece never matches it (`rss.xml` is not a slug, so no query). The feed route reads the published lists
through the cache and is `force-dynamic` in the app's file.

**Q5. A publish from the CLI and the page cache.** The CLI runs outside Next and cannot
`revalidateTag`; a running app keeps serving the cached lists and ISR pages for up to
`revalidateSeconds` (300 s), so a crawler that answers the IndexNow ping at once may see the old page.
FIRE has the same window. Closing it needs an authenticated revalidation endpoint in the app: a gap
for the followups roadmap (BF-10), not this change.

**Q6. The example app and IndexNow.** The example sets an IndexNow key, and `blog:fixtures` publishes
with `--commit`. Without an opt-out, every e2e setup would POST `http://localhost:3000/...` to
`api.indexnow.org`. `publish` gets `--no-indexnow`; `blog:fixtures` passes it. A submit with a
loopback origin is not special-cased (an explicit flag is clearer than a hidden rule).

**Q7. Read next: which texts?** Published articles only (terms have their own "explained in" list). The
article page already reads the published list (cached), so the related list costs no query.
