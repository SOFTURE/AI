# @softure-ai/seo

**Depends on:** core.

## 1. What it provides

What a public site needs to be found and cited, with or without the blog: a `robots.txt` that names
AI crawlers explicitly in three categories (search, on-demand fetchers, training), each switchable
off as one list, with the app's private paths closed to every crawler; an `htmlLimitedBots` list for
`next.config.ts` that keeps Next's defaults and adds the AI bots; a `sitemap.xml` from the app's
entries and other modules' contributors with a real `lastmod`; one canonical origin (apex or `www`,
trailing slash rule) for `metadata.alternates.canonical`; the IndexNow key file and
`submitToIndexNow(urls)`, a dry run unless told to commit. Ported from FIRE_TRACKER.

## 2. Installation

```bash
npm install @softure-ai/seo
```

No peer dependency: the `/next` adapter returns plain objects in the shape of Next's
`MetadataRoute.Robots` and `MetadataRoute.Sitemap`, and `/server` runs outside Next.

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

## 11. GDPR

Nothing: the module stores no personal data.

## 12. Limitations

- Per-page `robots` meta tags (`index`/`noindex`) stay in the app's pages: `robots.txt` asks crawlers
  not to fetch, a meta tag stops indexing.
- The key file is served at `/indexnow-key.txt`, not at `/<key>.txt`: IndexNow accepts any location
  given as `keyLocation`, and a root location covers every URL of the host.
- One IndexNow request takes at most 10,000 URLs; a longer list is refused, not split.
- The `htmlLimitedBots` list copies Next's default; a test fails when the installed Next changes it.
