// The blog's listing from @softure-ai/blog, with the example's call to action under the cards.
import { BlogIndexPage } from "@softure-ai/blog/next";
import { BlogCta } from "./blog-cta.tsx";

export { generateBlogIndexMetadata as generateMetadata } from "@softure-ai/blog/next";

// The build has no database: render per request over the blog's cached reads.
export const dynamic = "force-dynamic";

export default function BlogPage() {
  return <BlogIndexPage cta={<BlogCta />} />;
}
