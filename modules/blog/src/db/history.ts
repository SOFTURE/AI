// The history of articles an app published before it moved to this module: when each text first went
// public, when it last changed, and the slugs it had before. A first publish into `blog.*` would
// otherwise date every text today and lose the old addresses' 301s.
//
// The app exports it once from its own tables as JSON (README, "Moving an existing blog") and passes it
// to `softure-blog publish --history <file>`. It applies only to an article that has no row yet, so a
// re-run with the same file changes nothing, and the article file's own `published_at` still wins.
//
// Timestamps stay the text they were given and go into Postgres as text, so `…:12.421579Z` (what a
// `timestamptz` holds) is stored to the microsecond; a `Date` would keep only milliseconds. Digits past
// the sixth are rounded by Postgres.
import { z } from "zod";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const timestamp = z.iso.datetime({
  offset: true,
  error: (issue) =>
    issue.input === undefined
      ? "is required: an ISO 8601 timestamp, or null for a text that was never published"
      : "must be an ISO 8601 timestamp with a time zone, e.g. 2026-09-01T08:00:00Z",
});

const oldSlugSchema = z.strictObject({
  slug: z.string().max(100).regex(SLUG, "must be a kebab-case slug"),
  changed_at: timestamp.optional(),
});

const entrySchema = z
  .strictObject({
    id: z.string().max(100).regex(SLUG, "must be a kebab-case article id"),
    published_at: timestamp.nullable(),
    updated_at: timestamp.nullable().optional(),
    old_slugs: z.array(oldSlugSchema).default([]),
  })
  .refine((entry) => entry.updated_at === undefined || entry.updated_at === null || entry.published_at !== null, {
    message: "updated_at needs published_at: a text is updated only after it was published",
    path: ["updated_at"],
  });

export const articleHistorySchema = z
  .strictObject({ articles: z.array(entrySchema) })
  .superRefine((history, context) => {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    history.articles.forEach((entry, index) => {
      if (ids.has(entry.id)) context.addIssue({ code: "custom", path: ["articles", index, "id"], message: `"${entry.id}" is listed twice` });
      ids.add(entry.id);
      entry.old_slugs.forEach((old, slugIndex) => {
        if (slugs.has(old.slug)) context.addIssue({ code: "custom", path: ["articles", index, "old_slugs", slugIndex, "slug"], message: `"${old.slug}" is an old slug twice` });
        slugs.add(old.slug);
      });
    });
  });

/**
 * What the module keeps from an article's earlier life. Timestamps are ISO 8601 text with a time zone,
 * as the history gives them, so their full precision reaches the database.
 */
export interface ArticleHistory {
  readonly publishedAt: string | null;
  /** Kept only with `publishedAt`. */
  readonly updatedAt: string | null;
  readonly oldSlugs: readonly { readonly slug: string; readonly changedAt: string | null }[];
}

/** History by article id. */
export type ArticleHistoryMap = ReadonlyMap<string, ArticleHistory>;

/** The parsed history, or the problems that name the field (`articles.3.published_at: …`). */
export function parseArticleHistory(input: unknown): { readonly ok: true; readonly history: ArticleHistoryMap } | { readonly ok: false; readonly errors: readonly string[] } {
  const parsed = articleHistorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "history"}: ${issue.message}`) };
  }
  const orNull = (value: string | null | undefined) => value ?? null;
  return {
    ok: true,
    history: new Map(
      parsed.data.articles.map((entry) => [
        entry.id,
        {
          publishedAt: orNull(entry.published_at),
          updatedAt: orNull(entry.updated_at),
          oldSlugs: entry.old_slugs.map((old) => ({ slug: old.slug, changedAt: orNull(old.changed_at) })),
        },
      ]),
    ),
  };
}
