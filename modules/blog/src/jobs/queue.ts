// The blog's job queue, without importing @softure-ai/jobs: the CLI asks here whether to enqueue the
// IndexNow submit, and loads the jobs code only when the answer is yes.
import { getModule, type SoftureConfig } from "@softure-ai/core";

/** The queue of the IndexNow submit; define it in `jobs({ queues })` to submit through a worker. */
export const BLOG_INDEXNOW_QUEUE = "blog.indexnow";

const JOBS_MODULE_ID = "jobs";

/** Whether the config lists `jobs()` with a `blog.indexnow` queue. */
export function hasBlogIndexNowQueue(config: SoftureConfig): boolean {
  const options: unknown = getModule(config, JOBS_MODULE_ID)?.options;
  if (typeof options !== "object" || options === null || !("queues" in options)) return false;
  const { queues } = options;
  return typeof queues === "object" && queues !== null && Object.hasOwn(queues, BLOG_INDEXNOW_QUEUE);
}
