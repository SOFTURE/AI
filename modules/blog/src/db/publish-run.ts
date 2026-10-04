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
import { publishArticle, type BlogContext } from "./articles.js";

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

class DryRunRollback extends Error {}

class PublishRefused extends Error {
  constructor(readonly problem: PublishProblem) {
    super(problem.message);
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
        const result = await publishArticle({ ...ctx, db: tx }, input);
        if (!result.ok) {
          const reason = result.error === "blog.slug_taken" ? "is the slug of" : "redirects to";
          throw new PublishRefused({ subject: input.id, message: `slug ${input.slug} ${reason} article ${result.otherArticleId} (${result.error})` });
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
      if (options.commit !== true) throw new DryRunRollback();
    });
  } catch (error) {
    if (error instanceof DryRunRollback) return { status: "done", committed: false, changes, warnings };
    if (error instanceof PublishRefused) return { status: "refused", problems: [error.problem], warnings };
    if (getSqlState(error) === EXCLUSION_VIOLATION) {
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

/** The SQLSTATE of a driver error; drizzle wraps it as the `cause`. */
function getSqlState(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current instanceof Error && depth < 3; current = current.cause, depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
