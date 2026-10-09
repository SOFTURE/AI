// The Next.js adapter of @softure-ai/blog: the pages, their metadata, the article's OG image, the RSS
// feed, the cache refresh route and the cached reads (docs/02-module-standard.md §8).
export { findArticlesLinkingTermFor, getBodyOptions, type ArticlesLinkingTermInput } from "./body.js";
export { getBlogContext, getPageContext } from "./context.js";
export { serveBlogRss } from "./discovery.js";
export { buildArticleJsonLd, buildGlossaryJsonLd, buildTermJsonLd, getCrumbLabels } from "./json-ld.js";
export {
  buildArticleMetadata,
  buildBlogIndexMetadata,
  buildGlossaryIndexMetadata,
  buildMethodMetadata,
  buildTermMetadata,
  type ListingMetadataInput,
} from "./metadata.js";
export { refreshBlogCache } from "./refresh.js";
export { BLOG_CACHE_TAG, getFeaturedArticles, getPublishedArticles, getPublishedTerms, getStaticPublishedArticles, getTextBySlug } from "./data.js";
export { createOgFontLoader, loadBrandOgFonts, type OgFontLoaderOptions, type OgFontsResult } from "./og-fonts.js";
export { BlogArticleOgImage, createBlogArticleOgImage, getOgColors, getOgFontFamily, OG_IMAGE_SIZE, renderArticleOgImage, type OgColors, type OgFont, type BlogArticleOgImageOptions, type RenderArticleOgImageInput } from "./og-image.js";
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
  type BlogViewPageProps,
  type GlossaryTermPageProps,
} from "./pages.js";
