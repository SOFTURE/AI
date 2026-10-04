// An article from @softure-ai/blog, with the example's call to action and the waitlist form
// (placement "blog") under it. 301 and 410 come from the blog's piece in proxy.ts.
import { BlogArticlePage } from "@softure-ai/blog/next";
import { Waitlist } from "@softure-ai/waitlist/next";
import { BlogCta } from "../blog-cta.tsx";

export { generateArticleMetadata as generateMetadata, generateBlogStaticParams as generateStaticParams } from "@softure-ai/blog/next";

// ISR: rendered on the first request, kept for as long as blog({ revalidateSeconds }) caches reads.
export const revalidate = 300;

export default function ArticlePage({ params }: { readonly params: Promise<{ readonly slug: string }> }) {
  return <BlogArticlePage params={params} cta={<BlogCta />} afterArticle={<Waitlist placement="blog" />} />;
}
