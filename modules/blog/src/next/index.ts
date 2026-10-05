// The Next.js adapter of @softure-ai/blog: the pages, their metadata, the article's OG image, the RSS
// feed, the cache refresh route and the cached reads (docs/02-module-standard.md §8).
export { getBlogContext, getPageContext } from "./context.js";
export { serveBlogRss } from "./discovery.js";
export { refreshBlogCache } from "./refresh.js";
export { BLOG_CACHE_TAG, getPublishedArticles, getPublishedTerms, getTextBySlug } from "./data.js";
export { createOgFontLoader, loadBrandOgFonts, type OgFontLoaderOptions, type OgFontsResult } from "./og-fonts.js";
export { BlogArticleOgImage, getOgColors, getOgFontFamily, OG_IMAGE_SIZE, renderArticleOgImage, type OgFont, type RenderArticleOgImageInput } from "./og-image.js";
export type { OgFontSource, OgFontWeight } from "../options.js";
export {
  BlogArticlePage,
  BlogIndexPage,
  BlogMethodPage,
  generateArticleMetadata,
  generateBlogIndexMetadata,
  generateBlogStaticParams,
  generateGlossaryIndexMetadata,
  generateMethodMetadata,
  generateTermMetadata,
  GlossaryIndexPage,
  GlossaryTermPage,
  type BlogArticlePageProps,
  type BlogIndexPageProps,
  type GlossaryTermPageProps,
} from "./pages.js";
