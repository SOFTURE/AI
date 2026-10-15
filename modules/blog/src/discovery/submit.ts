// The IndexNow submit after a publish: the CLI calls it after `softure-blog publish`, and an app with
// its own publishing path calls it after `runBlogPublish`. With a `blog.indexnow` queue in
// `jobs({ queues })`, the CLI enqueues the submit instead (`enqueueBlogIndexNow`, `@softure-ai/blog/jobs`).
import type { SoftureConfig } from "@softure-ai/core";
import { getBlogRoutes } from "../server/options.js";
import { getIndexNowPaths, type IndexNowChange } from "./indexnow.js";
import { loadIndexNowTarget } from "./indexnow-target.js";

export type BlogIndexNowOutcome =
  /** seo is not listed, or it has no IndexNow key: nothing is sent. */
  | { readonly kind: "not_configured"; readonly reason: string }
  /** The run changed no public address. */
  | { readonly kind: "skipped" }
  /** No commit: the URLs a commit would submit, and no request. */
  | { readonly kind: "dry_run"; readonly endpoint: string; readonly urls: readonly string[] }
  | { readonly kind: "submitted"; readonly status: number; readonly count: number }
  /** Enqueued as a `blog.indexnow` job; a worker submits it with retries. `isDuplicate`: a pending job already had these paths. */
  | { readonly kind: "queued"; readonly jobId: string; readonly count: number; readonly isDuplicate: boolean }
  | { readonly kind: "failed"; readonly code: string; readonly reason: string };

export interface BlogIndexNowSubmit {
  /** The changed paths (`getIndexNowPaths`), also when nothing is sent. */
  readonly paths: readonly string[];
  readonly outcome: BlogIndexNowOutcome;
}

export interface SubmitBlogChangesOptions {
  /** Sends the request only when `true`, i.e. after a committed run; otherwise a dry run. */
  readonly commit?: boolean;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Submits the addresses a publish run changed through seo's IndexNow, on seo's site origin. Refresh
 * the app's cache first (`requestBlogRefresh`, or `revalidateTag("softure-blog", { expire: 0 })` inside
 * Next), so a crawler that comes at once sees the new text.
 * Never throws for an expected failure: a submit is an extra after a publish and must not undo it.
 */
export async function submitBlogChanges(config: SoftureConfig, changes: readonly IndexNowChange[], options: SubmitBlogChangesOptions = {}): Promise<BlogIndexNowSubmit> {
  const paths = getIndexNowPaths(changes, getBlogRoutes(config));
  const target = await loadIndexNowTarget(config);
  if (target.kind === "not_configured") return { paths, outcome: target };

  const result = await target.send(target.toUrls(paths), {
    commit: options.commit === true,
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
  });
  switch (result.kind) {
    case "dry_run":
      return { paths, outcome: { kind: "dry_run", endpoint: result.endpoint, urls: result.body.urlList } };
    case "failed":
      return { paths, outcome: { kind: "failed", code: result.code, reason: result.reason } };
    default:
      return { paths, outcome: result };
  }
}
