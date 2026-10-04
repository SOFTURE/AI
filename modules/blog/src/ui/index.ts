// Server components of the blog's pages. They take ready data and copy and import nothing from Next,
// so an app can compose its own page from them; `@softure-ai/blog/next` wires them to the config.
export { ArticleBody, ArticleDatesList, BlogArticleView, SourceList, type BlogArticleViewProps, type RenderedBody } from "./blog-article.js";
export { GlossaryIndexView, GlossaryTermView, type GlossaryIndexViewProps, type GlossaryTermViewProps } from "./blog-glossary.js";
export { BlogFooterNote, BlogLayout, Breadcrumbs, JsonLdScript, type BlogLayoutProps } from "./blog-layout.js";
export { BlogListingView, type BlogListingViewProps } from "./blog-listing.js";
export { BlogMethodView } from "./blog-method.js";
export type { BlogPageContext } from "./page-context.js";
