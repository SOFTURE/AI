// The days a page shows for a text, in the app's time zone. JSON-LD takes the same days, so the dates
// a search engine compares (`dateModified` against the visible update) cannot drift apart.
import { toCalendarDay, type Locale } from "@softure-ai/core";
import type { BlogArticle } from "../contract.js";

export interface ArticleDates {
  /** The day of first publication, `YYYY-MM-DD`. */
  readonly published: string;
  /** The day of the last content change; `null` without one, or when it falls on the publication day. */
  readonly updated: string | null;
  /** The day the facts were checked, `YYYY-MM-DD`. */
  readonly currentAsOf: string;
}

/** The calendar day of a moment in a time zone, `YYYY-MM-DD`: core's `toCalendarDay` under the name this module exports. */
export function getDayInZone(moment: Date, timezone: string): string {
  return toCalendarDay(moment, timezone);
}

/**
 * The visible dates of a published text. Two equal days one under the other read like a mistake, so
 * "updated" disappears when it falls on the publication day. A text without a publication date has
 * no page: calling this for one is a bug.
 */
export function getArticleDates(article: Pick<BlogArticle, "slug" | "publishedAt" | "updatedAt" | "currentAsOf">, timezone: string): ArticleDates {
  if (article.publishedAt === null) {
    throw new Error(`getArticleDates: article ${article.slug} has no published_at; pages show only published texts`);
  }
  const published = getDayInZone(article.publishedAt, timezone);
  const updated = article.updatedAt === null ? null : getDayInZone(article.updatedAt, timezone);
  return { published, updated: updated === published ? null : updated, currentAsOf: article.currentAsOf };
}

/** A `YYYY-MM-DD` day as the locale writes it in full (en: "October 4, 2026"). */
export function formatDay(day: string, locale: Locale): string {
  // The day is already a calendar day: format it at UTC midnight in UTC, so no zone shifts it.
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}
