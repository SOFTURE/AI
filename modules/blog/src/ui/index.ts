// Server components of the blog's pages. They take ready data and copy and import nothing from Next,
// so an app can compose its own page from them; `@softure-ai/blog/next` wires them to the config.
// `BlogToolIsland` is the one client component: the mount point of a tool block. Tool blocks are defined in the
// React-free root entry (`defineToolBlock`); `renderToolNode` renders their nodes with the app's islands.
export {
  ArticleBody,
  ArticleDatesList,
  BlogArticleView,
  RelatedList,
  SourceList,
  type BlogArticleViewProps,
  type BlogBodyNode,
  type RelatedListProps,
  type RenderedBody,
} from "./blog-article.js";
export { GlossaryIndexView, GlossaryTermView, type GlossaryIndexViewProps, type GlossaryTermViewProps } from "./blog-glossary.js";
export { BlogFooterNote, BlogLayout, Breadcrumbs, JsonLdScript, type BlogLayoutProps } from "./blog-layout.js";
export { BlogListingView, type BlogCardInput, type BlogCardRenderer, type BlogListingViewProps } from "./blog-listing.js";
export { BlogMethodView, type BlogMethodSection, type BlogMethodViewProps } from "./blog-method.js";
export { BlogToolIsland, type BlogToolIslandProps } from "./tool-island.js";
export { renderToolNode, type BlogToolIslands, type ToolIslandComponent } from "./tool-node.js";
export { lazyToolIsland } from "./lazy-tool-island.js";
export { BLOG_SLOT_CLASSES, getBlogSlotClass, type BlogClassNames, type BlogSlot } from "./class-names.js";
export type { BlogLayoutComponent, BlogLayoutSlotProps, BlogPageContext, BlogViewOptions } from "./page-context.js";
