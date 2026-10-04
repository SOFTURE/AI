// The blog's RSS feed from @softure-ai/blog. Dynamic: the build has no database, and the reads are
// cached for blog({ revalidateSeconds }) anyway.
export { serveBlogRss as GET } from "@softure-ai/blog/next";

export const dynamic = "force-dynamic";
