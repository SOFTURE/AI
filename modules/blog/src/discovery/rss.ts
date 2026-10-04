// The blog's RSS 2.0 feed (FIRE_TRACKER `src/lib/blog-discovery.ts`). An item is the title, the
// address, the description and the publication date, **without the body**: the reader goes to the
// page, where the sources and the disclaimer are; a text torn from them would be advice without context.
import type { BlogArticle } from "../contract.js";
import { getArticlePath, getTermPath, type BlogRoutes } from "../pages/paths.js";
import { getLatestModified, requirePublishedAt } from "./dates.js";

export type FeedText = Pick<BlogArticle, "id" | "slug" | "kind" | "title" | "description" | "cluster" | "publishedAt" | "updatedAt">;

export interface FeedChannel {
  readonly title: string;
  readonly description: string;
  /** The feed's language, e.g. `en` or `pl`. */
  readonly language: string;
}

export interface BuildBlogRssInput {
  readonly articles: readonly FeedText[];
  readonly terms: readonly FeedText[];
  /** The origin of every link, e.g. `https://example.com`. */
  readonly origin: string;
  readonly routes: BlogRoutes;
  /** The feed's own path (`routes.rss`), for `atom:link rel="self"`. */
  readonly feedPath: string;
  readonly channel: FeedChannel;
  /** An item's `<category>`: e.g. the cluster label of an article, the glossary title of a term; `null` for none. */
  readonly getCategory: (text: FeedText) => string | null;
}

const XML_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

/**
 * The feed of the published articles and terms together, newest publication first. `guid` is the
 * text's id with `isPermaLink="false"`: it survives a slug change, so a reader never shows an old text
 * again as new. `lastBuildDate` is the newest change, absent for an empty blog.
 */
export function buildBlogRss(input: BuildBlogRssInput): string {
  const absolute = (path: string) => new URL(path, input.origin).toString();
  const lastModified = getLatestModified([...input.articles, ...input.terms]);
  const items = [
    ...input.articles.map((text) => ({ text, path: getArticlePath(input.routes, text.slug) })),
    ...input.terms.map((text) => ({ text, path: getTermPath(input.routes, text.slug) })),
  ]
    .sort((a, b) => requirePublishedAt(b.text).getTime() - requirePublishedAt(a.text).getTime())
    .map(({ text, path }) => {
      const category = input.getCategory(text);
      return [
        "    <item>",
        `      <title>${escapeXml(text.title)}</title>`,
        `      <link>${escapeXml(absolute(path))}</link>`,
        `      <guid isPermaLink="false">${escapeXml(text.id)}</guid>`,
        `      <description>${escapeXml(text.description)}</description>`,
        `      <pubDate>${requirePublishedAt(text).toUTCString()}</pubDate>`,
        ...(category === null ? [] : [`      <category>${escapeXml(category)}</category>`]),
        "    </item>",
      ].join("\n");
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(input.channel.title)}</title>`,
    `    <link>${escapeXml(absolute(input.routes.index))}</link>`,
    `    <description>${escapeXml(input.channel.description)}</description>`,
    `    <language>${escapeXml(input.channel.language)}</language>`,
    `    <atom:link href="${escapeXml(absolute(input.feedPath))}" rel="self" type="application/rss+xml"/>`,
    ...(lastModified === null ? [] : [`    <lastBuildDate>${lastModified.toUTCString()}</lastBuildDate>`]),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
