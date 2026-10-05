// The blog's RSS feed route in Next, over the cached reads of `data.ts` (one query per
// `revalidateSeconds`). The sitemap contributor is `blogSitemap()` of the root entry (`../sitemap.ts`).
//
//   app/blog/rss.xml/route.ts   export { serveBlogRss as GET } from "@softure-ai/blog/next";
//                               export const dynamic = "force-dynamic";
import { errorLogLabel, formatMessage, getSiteUrls } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { buildBlogRss } from "../discovery/rss.js";
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
      urls: getSiteUrls(config),
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
