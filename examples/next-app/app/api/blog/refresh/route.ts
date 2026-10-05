// POST /api/blog/refresh: the blog's cache refresh from @softure-ai/blog. `npm run blog:publish -- --commit`
// calls it when BLOG_REFRESH_SECRET is set, so the pages show the change at once
// (e2e/blog-refresh.serial.spec.ts); its bucket is spread into security({ buckets }).
export { refreshBlogCache as POST } from "@softure-ai/blog/next";
