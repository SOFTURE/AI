// A publish run (FIRE_TRACKER `src/db/blog-publish.ts`): the heart of `softure-blog publish`.
//
// All or nothing. Every file is read and checked before the first write, and the writes go
// through one transaction: one bad file or one taken slug, and no row changes. A release publishes
// the whole folder, and half a folder in production is worse than no change.
//
// A dry run unless `commit`: the transaction is rolled back, but the result shows exactly what a
// commit would do (the rows before and after, read from the database).
import type { BlogArticleInput, BlogArticleKind, BlogArticleStatus, BlogPublishAction } from "../contract.js";
import { parseArticleFile, type ParseArticleFileOptions } from "../content/article-file.js";
import type { Queryable } from "@softure-ai/db";
import { eq } from "drizzle-orm";
import { findTermFormConflicts, toGlossary } from "../render/glossary.js";
import { listArticles, publishArticle, type BlogContext } from "./articles.js";
import { articles } from "./schema.js";

export interface ArticleFile {
  /** The file name (or path); it must read `<slug>.md`. */
  readonly name: string;
  readonly text: string;
}

/**
 * The quality gate (BL-6 fills it): the problems of a file that is about to go public. It runs only
 * for files whose status is `published` and not under `withdraw`: a withdrawal must always pass, and a
 * draft reaches no reader.
 */
export type PublishGate = (file: ArticleFile, article: BlogArticleInput) => readonly string[];

export interface RunBlogPublishOptions extends ParseArticleFileOptions {
  /** Write the changes; without it the run is a dry run. */
  readonly commit?: boolean;
  /** Publish the files as `withdrawn`, whatever their status (taking a text down at once). */
  readonly withdraw?: boolean;
  readonly gate?: PublishGate;
}

/** A problem that stops the run; `subject` is a file name, an article id or a cluster. */
export interface PublishProblem {
  readonly subject: string;
  readonly message: string;
}

/** What the run did (or would do) to one article; BL-5 derives the changed addresses from it. */
export interface PublishedChange {
  readonly id: string;
  readonly kind: BlogArticleKind;
  readonly action: BlogPublishAction;
  readonly statusBefore: BlogArticleStatus | null;
  readonly statusAfter: BlogArticleStatus;
  readonly slugBefore: string | null;
  readonly slug: string;
  /** The slug that entered the slug history in this run. */
  readonly previousSlug: string | null;
}

export type BlogPublishRun =
  | { readonly status: "refused"; readonly problems: readonly PublishProblem[]; readonly warnings: readonly PublishProblem[] }
  | { readonly status: "done"; readonly committed: boolean; readonly changes: readonly PublishedChange[]; readonly warnings: readonly PublishProblem[] };

/** SQLSTATE of an exclusion constraint violation: the deferred one-pillar rule at commit. */
const EXCLUSION_VIOLATION = "23P01";
/** SQLSTATE of a unique violation; on `articles_slug_key` it is a lost slug race. */
const UNIQUE_VIOLATION = "23505";
const SLUG_CONSTRAINT = "articles_slug_key";

class DryRunRollback extends Error {}

class PublishRefused extends Error {
  constructor(readonly problems: readonly PublishProblem[]) {
    super(problems.map((problem) => problem.message).join("; "));
  }
}

export async function runBlogPublish(ctx: BlogContext, files: readonly ArticleFile[], options: RunBlogPublishOptions = {}): Promise<BlogPublishRun> {
  const problems: PublishProblem[] = [];
  const warnings: PublishProblem[] = [];
  const inputs: BlogArticleInput[] = [];

  for (const file of files) {
    const parsed = parseArticleFile(file.text, file.name, options);
    if (!parsed.ok) {
      problems.push(...parsed.errors.map((message) => ({ subject: file.name, message })));
      continue;
    }
    const isGoingPublic = options.withdraw !== true && parsed.article.status === "published";
    const gateProblems = isGoingPublic && options.gate !== undefined ? options.gate(file, parsed.article) : [];
    if (gateProblems.length > 0) {
      problems.push(...gateProblems.map((message) => ({ subject: file.name, message: `quality gate: ${message}` })));
      continue;
    }
    if (options.withdraw === true && parsed.article.status !== "withdrawn") {
      warnings.push({
        subject: file.name,
        message: `the file says status: ${parsed.article.status}; set it to withdrawn, or the next full publish brings the text back`,
      });
    }
    inputs.push(options.withdraw === true ? { ...parsed.article, status: "withdrawn" } : parsed.article);
  }

  problems.push(...findDuplicateIds(inputs), ...findPillarProblems(inputs));
  if (problems.length > 0) return { status: "refused", problems, warnings };

  const changes: PublishedChange[] = [];
  try {
    await ctx.db.transaction(async (tx) => {
      for (const input of inputs) {
        const result = await publishArticleOrRefuse({ ...ctx, db: tx }, input);
        if (!result.ok) {
          const reason = result.error === "blog.slug_taken" ? "is the slug of" : "redirects to";
          throw new PublishRefused([{ subject: input.id, message: `slug ${input.slug} ${reason} article ${result.otherArticleId} (${result.error})` }]);
        }
        changes.push({
          id: input.id,
          kind: input.kind,
          action: result.action,
          statusBefore: result.before?.status ?? null,
          statusAfter: result.after.status,
          slugBefore: result.before?.slug ?? null,
          slug: result.after.slug,
          previousSlug: result.previousSlug,
        });
      }
      const glossary = await checkGlossaryForms({ ...ctx, db: tx }, inputs);
      if (glossary.problems.length > 0) throw new PublishRefused(glossary.problems);
      warnings.push(...glossary.warnings);
      if (options.commit !== true) throw new DryRunRollback();
    });
  } catch (error) {
    if (error instanceof DryRunRollback) return { status: "done", committed: false, changes, warnings };
    if (error instanceof PublishRefused) return { status: "refused", problems: error.problems, warnings };
    if (findDriverError(error)?.code === EXCLUSION_VIOLATION) {
      return {
        status: "refused",
        problems: [{ subject: "pillar", message: "a cluster would have two pillars: one is in the database and not in this run; mark only one text of a cluster pillar: true" }],
        warnings,
      };
    }
    throw error;
  }
  return { status: "done", committed: true, changes, warnings };
}

function findDuplicateIds(inputs: readonly BlogArticleInput[]): PublishProblem[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { id } of inputs) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates].map((id) => ({ subject: id, message: "two files have this id" }));
}

/**
 * One pillar per cluster among the run's texts that are not withdrawn, checked before any write
 * for a clear message. The database's deferred exclusion constraint also covers texts outside the
 * run (a run of one file).
 */
function findPillarProblems(inputs: readonly BlogArticleInput[]): PublishProblem[] {
  const pillars = new Map<string, string[]>();
  for (const input of inputs) {
    if (input.isPillar && input.cluster !== null && input.status !== "withdrawn") {
      pillars.set(input.cluster, [...(pillars.get(input.cluster) ?? []), input.id]);
    }
  }
  return [...pillars]
    .filter(([, ids]) => ids.length > 1)
    .map(([cluster, ids]) => ({ subject: cluster, message: `two pillars in one cluster: ${ids.join(", ")}` }));
}

/**
 * One term per glossary form, over the published terms as this run leaves them (read inside its
 * transaction, after its writes), so a run of one file sees the terms stored before it. A conflict
 * with a term of this run refuses the run; one only between stored terms is not this run's doing and
 * is a warning. The renderer links such a form to one of the terms either way.
 */
async function checkGlossaryForms(ctx: BlogContext, inputs: readonly BlogArticleInput[]): Promise<{ problems: PublishProblem[]; warnings: PublishProblem[] }> {
  const runTerms = new Set(inputs.filter((input) => input.kind === "term").map((input) => input.slug));
  const problems: PublishProblem[] = [];
  const warnings: PublishProblem[] = [];
  for (const conflict of findTermFormConflicts(toGlossary(await listArticles(ctx, { kind: "term" })))) {
    const problem = { subject: "glossary", message: `form "${conflict.form}" is claimed by terms ${conflict.slugs.join(", ")}; a form belongs to one term, so remove it from all but one` };
    if (conflict.slugs.some((slug) => runTerms.has(slug))) problems.push(problem);
    else warnings.push(problem);
  }
  return { problems, warnings };
}

/**
 * `publishArticle`, with a lost slug race turned into a refusal. Another run can commit the same
 * slug between this run's free-slug read and its write; the unique index then makes the write wait
 * for that run and fail with 23505. The savepoint is rolled back, so the transaction still reads
 * (at read committed, the winner's row is visible now) and names the article that took the slug.
 */
async function publishArticleOrRefuse(ctx: BlogContext, input: BlogArticleInput): ReturnType<typeof publishArticle> {
  try {
    return await publishArticle(ctx, input);
  } catch (error) {
    const driverError = findDriverError(error);
    if (driverError?.code !== UNIQUE_VIOLATION || driverError.constraint !== SLUG_CONSTRAINT) throw error;
    const winner = await findSlugOwner(ctx.db, input.slug);
    const owner = winner === undefined ? "another article published at the same time" : `article ${winner}`;
    throw new PublishRefused([{ subject: input.id, message: `slug ${input.slug} is the slug of ${owner} (blog.slug_taken)` }]);
  }
}

async function findSlugOwner(db: Queryable, slug: string): Promise<string | undefined> {
  const [row] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug));
  return row?.id;
}

interface DriverError {
  readonly code: string;
  readonly constraint: string | undefined;
}

/** The driver error (SQLSTATE and constraint) behind an error; drizzle wraps it as the `cause`. */
function findDriverError(error: unknown): DriverError | undefined {
  for (let current: unknown = error, depth = 0; current instanceof Error && depth < 3; current = current.cause, depth += 1) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (typeof code === "string") return { code, constraint: typeof constraint === "string" ? constraint : undefined };
  }
  return undefined;
}
