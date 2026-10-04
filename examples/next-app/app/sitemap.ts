// sitemap.xml from @softure-ai/seo, with the blog's texts from its contributor. Dynamic: the origin is
// APP_ORIGIN at runtime, not at build time, and the contributor reads the database.
import { sitemap } from "@softure-ai/seo/next";

export const dynamic = "force-dynamic";

export default sitemap;
