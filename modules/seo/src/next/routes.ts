// The files an app mounts, one line each (docs/02-module-standard.md §8):
// - `app/robots.ts`: `import { robots } from "@softure-ai/seo/next"; export default robots;`
// - `app/sitemap.ts`: `import { sitemap } from "@softure-ai/seo/next"; export default sitemap;`
// - `app/indexnow-key.txt/route.ts`: `export { serveIndexNowKey as GET } from "@softure-ai/seo/next";`
//
// Both metadata files read the origin from the config: when it comes from the environment at
// runtime (or a contributor reads a database), add `export const dynamic = "force-dynamic"` next to
// the default export, or Next bakes the build-time values into a static file.
import { buildRobots, type Robots } from "../robots.js";
import { buildSitemap, type SitemapUrl } from "../sitemap.js";
import { getSeoSettings } from "./settings.js";

// The return types are structural copies of Next's `MetadataRoute.Robots` and `MetadataRoute.Sitemap`:
// importing `next` here would pull Next's global types into every package that type-checks this one.
export function robots(): Robots {
  return buildRobots(getSeoSettings());
}

export async function sitemap(): Promise<SitemapUrl[]> {
  return buildSitemap(getSeoSettings());
}

/** `GET /indexnow-key.txt`: the key as plain text, or 404 when the app set no key. */
export function serveIndexNowKey(): Response {
  const { indexNowKey } = getSeoSettings();
  if (indexNowKey === null) {
    return new Response(null, { status: 404 });
  }
  return new Response(indexNowKey, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
