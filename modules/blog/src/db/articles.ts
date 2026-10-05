// The article store (FIRE_TRACKER `src/db/blog.ts`): the one write, `publishArticle`, called by the
// publish run, and the reads the blog pages use. Withdrawing is the same write with the status
// `withdrawn`; rows are never deleted, because a withdrawn address answers 410, not 404.
import type { ModuleContext } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import { and, asc, desc, eq, ne, type SQL } from "drizzle-orm";
import type { BlogArticle, BlogArticleInput, BlogArticleKind, BlogArticleState, BlogPublishResult } from "../contract.js";
import { articles, slugHistory } from "./schema.js";

export type BlogContext = ModuleContext<Queryable>;

/**
 * Inserts or updates the article by its `id`. Idempotent: the same file again is `unchanged` and
 * writes nothing, so a release can publish every file on every deploy.
 *
 * Dates:
 * - `published_at` is the file's date when given; otherwise the row's; otherwise the moment the
 *   text first becomes `published`. A draft gets none.
 * - `updated_at` moves only when the content hash of a text that already has `published_at` changes.
 *
 * Runs in a transaction that locks the row (`FOR UPDATE`), so two publishes of one article never
 * overwrite each other silently; inside an open transaction it becomes a savepoint.
 */
export async function publishArticle(ctx: BlogContext, input: BlogArticleInput): Promise<BlogPublishResult> {
  return ctx.db.transaction(async (tx) => {
    const [existing] = await tx.select().from(articles).where(eq(articles.id, input.id)).for("update");

    // Current slugs first, then old ones (BF-12). A rename writes both tables in one commit, so a run
    // that reads before it commits finds the article still at the slug, and one that reads after finds
    // the slug in the history. Read the other way round, the rename could commit between the two reads
    // and the slug would end up both current here and an old slug of the renamed article.
    const [slugOwner] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.slug, input.slug), ne(articles.id, input.id)));
    if (slugOwner !== undefined) return { ok: false, error: "blog.slug_taken", otherArticleId: slugOwner.id };

    const [historyOwner] = await tx
      .select({ articleId: slugHistory.articleId })
      .from(slugHistory)
      .where(and(eq(slugHistory.oldSlug, input.slug), ne(slugHistory.articleId, input.id)));
    if (historyOwner !== undefined) return { ok: false, error: "blog.slug_in_history", otherArticleId: historyOwner.articleId };

    const now = ctx.clock.now();
    const content = {
      slug: input.slug,
      kind: input.kind,
      cluster: input.cluster,
      isPillar: input.isPillar,
      title: input.title,
      description: input.description,
      summary: input.summary,
      bodyMarkdown: input.bodyMarkdown,
      status: input.status,
      currentAsOf: input.currentAsOf,
      sources: input.sources,
      faq: input.faq,
      termForms: input.termForms,
      fields: input.fields,
      contentSha256: input.contentSha256,
    };

    if (existing === undefined) {
      const publishedAt = input.publishedAt ?? (input.status === "published" ? now : null);
      const [inserted] = await tx
        .insert(articles)
        .values({ id: input.id, ...content, publishedAt, updatedAt: null, createdAt: now })
        .returning();
      return { ok: true, action: "added", before: null, after: readState(requireRow(inserted, input.id)), previousSlug: null };
    }

    const before = readState(existing);
    const publishedAt = input.publishedAt ?? existing.publishedAt ?? (input.status === "published" ? now : null);
    const isContentChanged = existing.contentSha256 !== input.contentSha256;
    const updatedAt = isContentChanged && existing.publishedAt !== null ? now : existing.updatedAt;
    const isSlugChanged = existing.slug !== input.slug;
    const isUnchanged =
      !isContentChanged &&
      !isSlugChanged &&
      existing.isPillar === input.isPillar &&
      existing.status === input.status &&
      isSameMoment(existing.publishedAt, publishedAt);
    if (isUnchanged) return { ok: true, action: "unchanged", before, after: before, previousSlug: null };

    if (isSlugChanged) {
      // Back to one of its own old slugs: that address is current again.
      await tx.delete(slugHistory).where(eq(slugHistory.oldSlug, input.slug));
      await tx.insert(slugHistory).values({ oldSlug: existing.slug, articleId: input.id, changedAt: now }).onConflictDoNothing();
    }

    const [updated] = await tx
      .update(articles)
      .set({ ...content, publishedAt, updatedAt })
      .where(eq(articles.id, input.id))
      .returning();
    return {
      ok: true,
      action: "changed",
      before,
      after: readState(requireRow(updated, input.id)),
      previousSlug: isSlugChanged ? existing.slug : null,
    };
  });
}

/** The article under its current slug, in any status: a page tells 200 from 410 by it. */
export async function findArticleBySlug(ctx: BlogContext, slug: string): Promise<BlogArticle | null> {
  const [row] = await ctx.db.select().from(articles).where(eq(articles.slug, slug));
  return row ?? null;
}

/** The published article under its current slug, or `null` (a draft, a withdrawn text, no text). */
export async function getPublishedArticle(ctx: BlogContext, slug: string): Promise<BlogArticle | null> {
  const [row] = await ctx.db
    .select()
    .from(articles)
    .where(and(eq(articles.slug, slug), eq(articles.status, "published")));
  return row ?? null;
}

/** The current slug of the article that once had `oldSlug`: the target of a 301. */
export async function findSlugRedirect(ctx: BlogContext, oldSlug: string): Promise<string | null> {
  const [row] = await ctx.db
    .select({ slug: articles.slug })
    .from(slugHistory)
    .innerJoin(articles, eq(articles.id, slugHistory.articleId))
    .where(eq(slugHistory.oldSlug, oldSlug));
  return row?.slug ?? null;
}

export interface ListArticlesFilter {
  readonly kind?: BlogArticleKind;
  readonly cluster?: string;
}

/** Published texts, newest first; ties by slug. Without a filter, both kinds. */
export async function listArticles(ctx: BlogContext, filter: ListArticlesFilter = {}): Promise<BlogArticle[]> {
  const conditions: SQL[] = [eq(articles.status, "published")];
  if (filter.kind !== undefined) conditions.push(eq(articles.kind, filter.kind));
  if (filter.cluster !== undefined) conditions.push(eq(articles.cluster, filter.cluster));
  return ctx.db
    .select()
    .from(articles)
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt), asc(articles.slug));
}

function readState(row: BlogArticle): BlogArticleState {
  return { slug: row.slug, status: row.status, publishedAt: row.publishedAt, updatedAt: row.updatedAt, contentSha256: row.contentSha256 };
}

function isSameMoment(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

/** `RETURNING` of a write that matched its row; nothing else is possible inside the row lock. */
function requireRow(row: BlogArticle | undefined, id: string): BlogArticle {
  if (row === undefined) throw new Error(`publishArticle: the write of article ${id} returned no row`);
  return row;
}
