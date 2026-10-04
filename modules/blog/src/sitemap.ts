// The sitemap contributor for `@softure-ai/seo`, in the root entry because `softure.config.ts` imports
// it: that file also loads in plain Node (`softure migrate`, the blog command), where the Next adapter
// cannot. The adapter is imported when the sitemap is requested, inside Next.
import type { SoftureConfig } from "@softure-ai/core";
import type { BlogSitemapEntry } from "./discovery/sitemap.js";

/**
 * `seo({ sitemap: { contributors: [blogSitemap()] } })`: the listing, the articles, the glossary, its
 * terms and the method page, each dated by its last content change, over the pages' cached reads.
 * The config is read when the sitemap is requested (it is still being defined when this is called);
 * pass one to read another. Mount `app/sitemap.ts` with `dynamic = "force-dynamic"`.
 */
export function blogSitemap(config?: SoftureConfig): () => Promise<BlogSitemapEntry[]> {
  return async () => {
    const { readBlogSitemap } = await import("./next/discovery.js");
    return readBlogSitemap(config);
  };
}
