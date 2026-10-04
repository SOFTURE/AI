// A published text with only the fields discovery reads; tests override them.
import type { BlogArticle } from "@softure-ai/blog";
import type { BlogRoutes } from "@softure-ai/blog/server";

export type DiscoveryText = Pick<BlogArticle, "id" | "slug" | "kind" | "title" | "description" | "cluster" | "isPillar" | "publishedAt" | "updatedAt">;

export const ROUTES: BlogRoutes = { index: "/blog", glossary: "/blog/glossary", method: "/blog/how-we-write", rss: "/blog/rss.xml" };

export function buildText(id: string, overrides: Partial<DiscoveryText> = {}): DiscoveryText {
  return {
    id,
    slug: id,
    kind: "article",
    title: `Title ${id}`,
    description: `Description ${id}`,
    cluster: "investing-basics",
    isPillar: false,
    publishedAt: new Date("2026-10-01T08:00:00Z"),
    updatedAt: null,
    ...overrides,
  };
}

export const getIds = (texts: readonly { readonly id: string }[]) => texts.map((text) => text.id);
