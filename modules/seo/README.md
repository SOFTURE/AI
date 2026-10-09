# @softure-ai/seo

**Depends on:** core.

## 1. What it provides

What a public site needs to be found and cited, with or without the blog: a `robots.txt` that names
AI crawlers explicitly in three categories (search, on-demand fetchers, training), each switchable
off as one list, with the app's private paths closed to every crawler; an `htmlLimitedBots` list for
`next.config.ts` that keeps Next's defaults and adds the AI bots; a `sitemap.xml` from the app's
entries and other modules' contributors with a real `lastmod`; one canonical origin (apex or `www`,
trailing slash rule) for `metadata.alternates.canonical`; the IndexNow key file and
`submitToIndexNow(urls)`, a dry run unless told to commit; and a Markdown version of every sitemap page
for agents that ask for it with `Accept: text/markdown` (`createPageMarkdown`, a proxy piece).

## 2. Installation

```bash
npm install @softure-ai/seo
```

No peer dependency: the `/next` adapter returns plain objects in the shape of Next's
`MetadataRoute.Robots` and `MetadataRoute.Sitemap`, `/server` runs outside Next, and `/proxy` uses only
Web `Request` and `Response`.

## 3. Configuration

```ts
// softure.config.ts
import { seo } from "@softure-ai/seo";

modules: [
  seo({
    // The public site, when it is not `appOrigin` (e.g. an apex next to an `app.` host).
    origin: "https://example.com",
    canonical: { host: "apex", trailingSlash: false },
    // Everything closed but these pages. `/` next to a disallowed `/` is written `/$`: the root only.
    robots: { allow: ["/", "/pricing", "/blog"], disallow: ["/"] },
    // Every category is allowed by default; `enabled: false` closes the site to it.
    crawlers: { training: { enabled: false }, onDemand: { extra: ["Acme-User"] } },
    sitemap: {
      entries: [{ path: "/", priority: 1 }, { path: "/pricing", lastModified: new Date("2026-10-01") }],
      contributors: [/* e.g. the blog's published articles (BL-5) */],
    },
    // Public by protocol; read it from the environment if you prefer: process.env.INDEXNOW_KEY.
    indexNow: { key: "0123456789abcdef0123456789abcdef" },
  }),
],
```

| Option | Default | Meaning |
| --- | --- | --- |
| `origin` | the config's `appOrigin` | origin of the public site |
| `canonical.host` | `"as-is"` | `"apex"` drops a leading `www.`, `"www"` adds it |
| `canonical.trailingSlash` | `false` | every canonical path but `/` ends with `/` when `true` |
| `robots.allow` | `["/"]` | paths open to crawlers |
| `robots.disallow` | `[]` | private paths, closed in every group, named ones included |
| `robots.other` | `{}` | more lines for every group, e.g. `{ "Content-Signal": "ai-train=yes, search=yes" }`; a list writes one line per value |
| `crawlers.{search,onDemand,training}` | `{ enabled: true, extra: [] }` | each category on or off, plus the app's own tokens |
| `sitemap.entries` | `[]` | the app's pages; `lastModified` only when known |
| `sitemap.contributors` | `[]` | `(context) => SitemapEntry[]`, sync or async, run per request |
| `indexNow.key` | none | 8-128 letters, digits or dashes; without it the key file answers 404 |

Routes (overridable with `routes`): `sitemap: "/sitemap.xml"`, `indexNowKey: "/indexnow-key.txt"`.

The crawler lists are exported (`AI_SEARCH_CRAWLERS`, `AI_ON_DEMAND_FETCHERS`,
`AI_TRAINING_CRAWLERS`); a bot added to them ships in a minor release, and `extra` adds one today.

## 4. Mounting

```ts
// app/robots.ts
import { robots } from "@softure-ai/seo/next";
export const dynamic = "force-dynamic";
export default robots;

// app/sitemap.ts
import { sitemap } from "@softure-ai/seo/next";
export const dynamic = "force-dynamic";
export default sitemap;

// app/indexnow-key.txt/route.ts
export { serveIndexNowKey as GET } from "@softure-ai/seo/next";

// next.config.ts
import { buildHtmlLimitedBots } from "@softure-ai/seo";
const nextConfig = { htmlLimitedBots: buildHtmlLimitedBots() };

// any page
import { getCanonicalUrl } from "@softure-ai/seo/next";
export const metadata = { alternates: { canonical: getCanonicalUrl("/pricing") } };
```

`dynamic = "force-dynamic"` is needed when the origin comes from the environment at runtime or a
contributor reads a database: otherwise Next renders the file once at build time and keeps those
values. A page using `getCanonicalUrl` in a static `metadata` export has the same rule.

seo is also the app's **site URL provider** (core's `getSiteUrls`, `getSeoSiteUrls` here): other modules'
pages, such as the blog's canonical, Open Graph, JSON-LD and feed URLs, follow the same origin, host and
trailing-slash rule as the sitemap without importing seo.

Submitting changed URLs (a publish script, outside a request):

```ts
import { getSeoSettings } from "@softure-ai/seo/next";
import { submitToIndexNow } from "@softure-ai/seo/server";

const { indexNowKey, siteOrigin, routes } = getSeoSettings(config);
if (indexNowKey !== null) {
  const result = await submitToIndexNow(["/blog/new-article", "/blog"], {
    key: indexNowKey, siteOrigin, keyPath: routes.indexNowKey, commit: process.argv.includes("--commit"),
  });
}
// { kind: "dry_run", body } | { kind: "submitted", status, count } | { kind: "skipped" } | { kind: "failed", code, reason }
```

The request carries only `content-type`. An app that signs its outgoing requests (e.g. web-bot-auth)
passes its signing fetch as `fetchImpl`; the module calls it like `fetch` and reads only the status:

```ts
await submitToIndexNow(urls, { key: indexNowKey, siteOrigin, keyPath: routes.indexNowKey, commit: true,
  fetchImpl: (input, init) => signedFetch(input, init) });
```

### Markdown for agents

An agent that sends `Accept: text/markdown` for a public page gets the page's main content as Markdown
at the same address; a browser, curl and crawlers (`*/*`) keep getting the HTML. Chain the piece in the
app's `proxy.ts`, after the blog's Markdown piece (which answers its texts from the stored Markdown) and
before a route guard:

```ts
// proxy.ts
import { createBlogMarkdown } from "@softure-ai/blog/proxy";
import { createPageMarkdown } from "@softure-ai/seo/proxy";

const blogMarkdown = createBlogMarkdown(softureConfig);
const pageMarkdown = createPageMarkdown(softureConfig, { remove: [".toc"] });

export async function proxy(request: NextRequest) {
  return (await blogMarkdown(request)) ?? (await pageMarkdown(request)) ?? guard(request) ?? NextResponse.next();
}
```

- **Which pages:** exactly the sitemap's (the app's entries and the contributors'), compared by
  canonical URL and read at most once per `cacheSeconds` (default 60). `paths: (pathname) => boolean`
  chooses otherwise.
- **How:** the piece fetches the page from the app's own server (`selfOrigin`, by default
  `http://127.0.0.1:${PORT ?? 3000}`, not the public host a reverse proxy sits behind) with
  `Accept: text/html` and nothing else: no cookie, no authorization, no query. The answer is what an
  anonymous visitor sees, so nothing behind a session is reachable this way.
- **What:** `htmlToMarkdown` (`@softure-ai/seo/server`) of the `<main>` element (`root`), without
  nav, scripts, SVG, controls, forms, dialogs, hidden nodes, a header or footer in `<main>` that no
  article, section or aside holds (also inside a layout wrapper; an article's own header stays) and the
  app's `remove` selectors; links and images absolute
  on the site origin; after a frontmatter of `title`, `description` and `url` (the page's canonical
  link, else the canonical URL of the path).
- **Headers:** `content-type: text/markdown; charset=utf-8`, `vary: Accept`,
  `cache-control: private, max-age=0, must-revalidate` (a shared cache must not hand Markdown to a
  browser), `x-markdown-tokens` (about four characters a token). HEAD gets the headers only.
- **A redirect** of the render (301, 302, 303, 307, 308) answers as the same redirect, its `Location`
  resolved and moved from the app's own server to the site origin (another site's address is kept),
  with `vary: Accept`: the agent follows it asking for Markdown again.
- **A missing page** (404 or 410 HTML) answers its `<main>` as Markdown with the same status.
- **Anything else** (an error, a page without `<main>`, a redirect without `Location`, a failed render)
  answers `null`, and the page answers the request itself; failures are reported through `onError`
  (`console.error` by default).

`prefersMarkdown(accept)` (root entry) is the negotiation rule on its own: `text/markdown` must be
named, the weights follow RFC 9110, and a tie with HTML goes to Markdown.

## 5. Migrations and tables

None: the module has no database schema.

## 6. Environment variables

None. The IndexNow key is an option (public by protocol); an app may fill it from its own variable.

## 7. Switches

None.

## 8. Appearance

None: the module renders machine formats only.

## 9. Copy

None: `src/messages/en.ts` and `pl.ts` are empty dictionaries kept for the standard's shape.

## 10. Hooks

`sitemap.contributors`: functions that list more pages at request time. A contributor that throws or
rejects is logged and left out, and an entry whose path is not on the site is skipped; the rest of
the sitemap is served.

`createPageMarkdown` options: `paths`, `cacheSeconds`, `selfOrigin`, `root`, `remove`, `onError`, and
`fetch` / `now` for tests.

## 11. GDPR

Nothing: the module stores no personal data.

## 12. Limitations

- Per-page `robots` meta tags (`index`/`noindex`) stay in the app's pages: `robots.txt` asks crawlers
  not to fetch, a meta tag stops indexing.
- The key file is served at `/indexnow-key.txt`, not at `/<key>.txt`: IndexNow accepts any location
  given as `keyLocation`, and a root location covers every URL of the host.
- One IndexNow request takes at most 10,000 URLs; a longer list is refused, not split.
- The `htmlLimitedBots` list copies Next's default; a test fails when the installed Next changes it.
- A Markdown answer renders the page again on every request (it is `private`, so no shared cache keeps
  it); the page's own caching applies to that render.
- Pages are told apart by path only: a page whose content depends on the query or on the visitor has a
  single Markdown version, the anonymous one without a query.
