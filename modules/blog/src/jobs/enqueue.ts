// The enqueue step after a committed publish: one `blog.indexnow` job with the changed paths. The CLI
// calls it when the config has the queue; an app with its own publishing path calls it after
// `runBlogPublish` commits (and after its cache refresh, so the crawler finds the new text).
import { createHash } from "node:crypto";
import { enqueueJob } from "@softure-ai/jobs/server";
import type { BlogContext } from "../db/articles.js";
import { getIndexNowPaths, type IndexNowChange } from "../discovery/indexnow.js";
import { loadIndexNowTarget } from "../discovery/indexnow-target.js";
import type { BlogIndexNowSubmit } from "../discovery/submit.js";
import { getBlogRoutes } from "../server/options.js";
import type { BlogIndexNowPayload } from "./payload.js";
import { BLOG_INDEXNOW_QUEUE } from "./queue.js";

/**
 * Enqueues the IndexNow submit of a committed publish run. `ctx.db` may be a transaction. Returns
 * `queued` (with `isDuplicate` when a pending or running job already carries the same paths),
 * `skipped` when no public address changed, or `not_configured` when seo cannot submit, so no job
 * is written that could never succeed. Throws when the queue is not defined in `jobs({ queues })`;
 * database failures propagate.
 */
export async function enqueueBlogIndexNow(ctx: BlogContext, changes: readonly IndexNowChange[]): Promise<BlogIndexNowSubmit> {
  const paths = getIndexNowPaths(changes, getBlogRoutes(ctx.config));
  const target = await loadIndexNowTarget(ctx.config);
  if (target.kind === "not_configured") return { paths, outcome: target };
  if (paths.length === 0) return { paths, outcome: { kind: "skipped" } };

  const payload: BlogIndexNowPayload = { paths: [...paths] };
  const job = await enqueueJob(ctx, { queue: BLOG_INDEXNOW_QUEUE, payload, dedupKey: getDedupKey(paths) });
  return { paths, outcome: { kind: "queued", jobId: job.id, count: paths.length, isDuplicate: job.isDuplicate } };
}

/** The same set of paths is the same work: a re-run while a job is pending returns that job. */
function getDedupKey(paths: readonly string[]): string {
  const digest = createHash("sha256").update([...paths].sort().join("\n")).digest("hex");
  return `indexnow:${digest.slice(0, 32)}`;
}
