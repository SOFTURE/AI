// Server components of the blog's pages. They take ready data and copy and import nothing from Next,
// so an app can compose its own page from them; `@softure-ai/blog/next` wires them to the config.
// `BlogToolIsland` is the one client component: the mount point of a tool block.
export {
  ArticleBody,
  ArticleDatesList,
  BlogArticleView,
  RelatedList,
  SourceList,
  type BlogArticleViewProps,
  type RelatedListProps,
  type RenderedBody,
} from "./blog-article.js";
export { GlossaryIndexView, GlossaryTermView, type GlossaryIndexViewProps, type GlossaryTermViewProps } from "./blog-glossary.js";
export { BlogFooterNote, BlogLayout, Breadcrumbs, JsonLdScript, type BlogLayoutProps } from "./blog-layout.js";
export { BlogListingView, type BlogCardInput, type BlogCardRenderer, type BlogListingViewProps } from "./blog-listing.js";
export { BlogMethodView, type BlogMethodSection, type BlogMethodViewProps } from "./blog-method.js";
export { defineToolBlock, type ToolBlockDefinition, type ToolBlockIssue, type ToolBlockSchema } from "./tool-block.js";
export { BlogToolIsland, type BlogToolIslandProps } from "./tool-island.js";
export { BLOG_SLOT_CLASSES, getBlogSlotClass, type BlogClassNames, type BlogSlot } from "./class-names.js";
export type { BlogLayoutComponent, BlogLayoutSlotProps, BlogPageContext, BlogViewOptions } from "./page-context.js";
