// The dates search engines and feed readers get: the last real change of a text, never a build or
// request date. `updated_at` moves only when the content hash of a published text changes (BL-2), so
// it is a `lastmod` a search engine can trust.
import type { BlogArticle } from "../contract.js";

export type DatedText = Pick<BlogArticle, "slug" | "publishedAt" | "updatedAt">;

/** When a published text last changed: its update, else its publication. */
export function getTextLastModified(text: DatedText): Date {
  return text.updatedAt ?? requirePublishedAt(text);
}

/** The newest change among the texts; `null` for none. */
export function getLatestModified(texts: readonly DatedText[]): Date | null {
  return texts.reduce<Date | null>((latest, text) => {
    const moment = getTextLastModified(text);
    return latest === null || moment > latest ? moment : latest;
  }, null);
}

/** A published text always has `published_at` (the store sets it); a missing one is a bug, not a date to invent. */
export function requirePublishedAt(text: Pick<BlogArticle, "slug" | "publishedAt">): Date {
  if (text.publishedAt === null) {
    throw new Error(`requirePublishedAt: text ${text.slug} has no published_at; discovery takes published texts only`);
  }
  return text.publishedAt;
}
