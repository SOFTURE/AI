// The blog's discovery pieces in Next: the RSS feed route and the sitemap entries behind
// `blogSitemap()` (`../sitemap.ts`), both over the cached reads of `data.ts` (one query per
// `revalidateSeconds`).
//
//   app/blog/rss.xml/route.ts   export { serveBlogRss as GET } from "@softure-ai/blog/next";
//                               export const dynamic = "force-dynamic";
import { errorLogLabel, formatMessage, type SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { buildBlogRss } from "../discovery/rss.js";
import { getBlogSitemapEntries, type BlogSitemapEntry } from "../discovery/sitemap.js";
import { getClusterLabel } from "../pages/listing.js";
import { getBlogOptions } from "../server/options.js";
import { getPageContext } from "./context.js";
import { getPublishedArticles, getPublishedTerms } from "./data.js";

/** Seconds a feed reader should wait after a 503: the cache's own lifetime is a fair guess. */
const RETRY_AFTER_SECONDS = 300;

/**
 * `GET <routes.rss>`: the RSS 2.0 feed of the published articles and terms. A failed read answers
 * **503**, never an empty feed: a reader that got a feed without items could take the texts as deleted.
 */
export async function serveBlogRss(): Promise<Response> {
  const config = getSoftureConfig();
  const context = getPageContext(config);
  try {
    const [articles, terms] = await Promise.all([getPublishedArticles(config), getPublishedTerms(config)]);
    const { clusters } = getBlogOptions(config);
    const copy = context.messages;
    const xml = buildBlogRss({
      articles,
      terms,
      origin: config.appOrigin,
      routes: context.routes,
      feedPath: context.routes.rss,
      channel: {
        title: context.brand === null ? copy.pages.blogTitle : formatMessage(copy.pages.titleWithBrand, { title: copy.pages.blogTitle, brand: context.brand }),
        description: copy.pages.blogDescription,
        language: config.locale,
      },
      getCategory: (text) => (text.kind === "term" ? copy.glossary.title : text.cluster === null ? null : getClusterLabel(text.cluster, clusters, config.locale)),
    });
    return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
  } catch (error) {
    console.error(`blog: the RSS feed could not read the texts: ${errorLogLabel(error)}`);
    return new Response(context.messages.feed.unavailable, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": String(RETRY_AFTER_SECONDS) },
    });
  }
}

/**
 * The blog's sitemap entries: the listing, the articles, the glossary, its terms and the method page,
 * each with the date of its last real change. A failed read throws; seo logs it and serves the rest.
 */
export async function readBlogSitemap(config: SoftureConfig = getSoftureConfig()): Promise<BlogSitemapEntry[]> {
  const context = getPageContext(config);
  const [articles, terms] = await Promise.all([getPublishedArticles(config), getPublishedTerms(config)]);
  return getBlogSitemapEntries({ articles, terms, routes: context.routes, methodPath: context.methodPath });
}
