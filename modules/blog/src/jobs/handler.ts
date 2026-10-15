// The worker side of the IndexNow submit: a `blog.indexnow` job sends its paths through seo's
// IndexNow and tells the queue whether a retry can help.
import { err, ok } from "@softure-ai/core";
import { defineJobHandler, failJob, retryJobLater, type JobHandler, type JobHandlers } from "@softure-ai/jobs";
import { loadIndexNowTarget, type SeoIndexNowResult } from "../discovery/indexnow-target.js";
import { blogIndexNowPayloadSchema, type BlogIndexNowPayload } from "./payload.js";
import { BLOG_INDEXNOW_QUEUE } from "./queue.js";

/** What a handler returns (`ok()`, an `Err` to retry, `failJob`, `retryJobLater`). */
type JobRunResult = Awaited<ReturnType<JobHandler["run"]>>;

const TOO_MANY_REQUESTS = 429;
const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;

export interface CreateBlogIndexNowJobHandlerOptions {
  /** For tests. Default: the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/** What the engine answered last: seo folds the status into a message, the handler needs it as a number. */
interface ResponseRecord {
  status: number | null;
  retryAfter: string | null;
}

/**
 * The handler of the `blog.indexnow` queue. Succeeds when IndexNow takes the URLs; retries with the
 * queue's backoff when the engine cannot be reached or answers 5xx; retries after `Retry-After` on a
 * 429 (the backoff without the header); fails at once on any other 4xx, an invalid key or a URL off
 * the site, and when seo or its key is gone from the config, since a retry cannot fix those.
 */
export function createBlogIndexNowJobHandler(options: CreateBlogIndexNowJobHandlerOptions = {}): JobHandler<BlogIndexNowPayload> {
  return defineJobHandler({
    payload: blogIndexNowPayloadSchema,
    run: async ({ paths }, { config, signal }) => {
      const target = await loadIndexNowTarget(config);
      if (target.kind === "not_configured") return failJob("blog.indexnow_not_configured");
      const record: ResponseRecord = { status: null, retryAfter: null };
      const result = await target.send(target.toUrls(paths), { commit: true, fetchImpl: createRecordingFetch(options.fetchImpl ?? fetch, signal, record) });
      return classifyResult(result, record);
    },
  });
}

/** The handlers the blog contributes: spread them into the worker's handlers. */
export const blogJobHandlers: JobHandlers = { [BLOG_INDEXNOW_QUEUE]: createBlogIndexNowJobHandler() };

/** Passes the job's signal along with seo's own timeout, and keeps the answer's status. */
function createRecordingFetch(fetchImpl: typeof fetch, jobSignal: AbortSignal, record: ResponseRecord): typeof fetch {
  return async (input, init) => {
    const signal = init?.signal == null ? jobSignal : AbortSignal.any([init.signal, jobSignal]);
    const response = await fetchImpl(input, { ...init, signal });
    record.status = response.status;
    record.retryAfter = response.headers.get("retry-after");
    return response;
  };
}

function classifyResult(result: SeoIndexNowResult, record: ResponseRecord): JobRunResult {
  switch (result.kind) {
    case "submitted":
    case "skipped":
      return ok();
    case "dry_run":
      // `commit: true` above; a dry run here is a bug, and retrying cannot fix it.
      return failJob("blog.indexnow_not_sent");
    case "failed":
      return classifyFailure(result.code, record);
  }
}

function classifyFailure(code: string, record: ResponseRecord): JobRunResult {
  if (code === "seo.indexnow_unreachable") return err("blog.indexnow_unreachable");
  if (code !== "seo.indexnow_rejected" || record.status === null) return failJob("blog.indexnow_refused");
  if (record.status === TOO_MANY_REQUESTS) {
    const seconds = parseRetryAfter(record.retryAfter);
    return seconds === null ? err("blog.indexnow_rate_limited") : retryJobLater("blog.indexnow_rate_limited", seconds);
  }
  if (record.status >= 500) return err("blog.indexnow_server_error");
  return failJob("blog.indexnow_rejected");
}

/** `Retry-After` in seconds (`120`); the HTTP-date form and anything unreadable fall back to the backoff. */
function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  return Math.min(Number(value.trim()), MAX_RETRY_AFTER_SECONDS);
}
