// One attempt of one claimed job: parse the payload with the handler's schema, run the handler, record the outcome
// (fenced by the claim). Shared by the worker and `runDueJobs`, so tests run the production path.
import type { ErrorCode } from "@softure-ai/core";
import type { JobOutcome } from "../contract.js";
import type { AnyJobHandler, JobHandlers, JobRunResult } from "../handlers.js";
import type { ClaimedJob, Completion } from "./claim.js";
import { completeJob } from "./claim.js";
import { clampRetrySeconds, getRetryDelaySeconds } from "./backoff.js";
import type { JobsContext } from "./context.js";
import type { JobsLogger } from "./logger.js";
import { getJobsOptions, getQueue } from "./options.js";

const INVALID_PAYLOAD = "jobs.invalid_payload";
const HANDLER_THREW = "jobs.handler_threw";
const MAX_ERROR_LENGTH = 200;

export interface RunClaimedJobOptions {
  readonly handlers: JobHandlers;
  readonly logger: JobsLogger;
  /** Aborted when the job is taken from the handler (shutdown after the grace period, lost lease). */
  readonly signal: AbortSignal;
  /** In [0, 1): the jitter of the retry delay. */
  readonly random: () => number;
}

/** Runs the handler once for a claimed job and records what happened. Database failures propagate. */
export async function runClaimedJob(ctx: JobsContext, claimed: ClaimedJob, options: RunClaimedJobOptions): Promise<JobOutcome> {
  const { job } = claimed;
  const fields = { queue: job.queue, jobId: job.id, attempt: job.attempts };
  const handler = getHandler(options.handlers, job.queue);

  const payload = handler.payload.safeParse(job.payload);
  if (!payload.success) {
    // Paths only: the values are the app's data.
    const paths = payload.error.issues.map((issue) => issue.path.map(String).join(".") || "(root)").join(", ");
    options.logger.warn("job payload does not match its handler's schema; failed without running", { ...fields, paths });
    return record(ctx, claimed, { kind: "failed", error: INVALID_PAYLOAD });
  }

  let result: JobRunResult;
  try {
    result = await handler.run(payload.data as never, { ...ctx, job, signal: options.signal });
  } catch (error) {
    options.logger.error("job handler threw", { ...fields, error });
    result = { ok: false, error: HANDLER_THREW };
  }
  if (options.signal.aborted) {
    // The job was released or taken over while the handler ran; the fenced write below would be refused anyway.
    return { kind: "stale" };
  }
  return record(ctx, claimed, decide(ctx, claimed, result, options));
}

function decide(ctx: JobsContext, claimed: ClaimedJob, result: unknown, options: RunClaimedJobOptions): Completion {
  const { job } = claimed;
  if (isOk(result)) return { kind: "succeeded" };
  const failure = readFailure(result);
  if (failure === null) {
    options.logger.error("job handler returned neither ok() nor an error; treated as a throw", { queue: job.queue, jobId: job.id });
  }
  const error = failure?.error ?? HANDLER_THREW;
  const isRetryable = failure?.retry !== false && job.attempts < job.maxAttempts;
  if (!isRetryable) return { kind: "failed", error };
  const queue = getQueue(getJobsOptions(ctx.config), job.queue);
  const delaySeconds =
    failure?.retryAfterSeconds === undefined
      ? getRetryDelaySeconds(queue.backoff, job.attempts, options.random)
      : clampRetrySeconds(failure.retryAfterSeconds);
  return { kind: "retry", error, runAt: new Date(ctx.clock.now().getTime() + Math.round(delaySeconds * 1000)) };
}

async function record(ctx: JobsContext, claimed: ClaimedJob, completion: Completion): Promise<JobOutcome> {
  const isRecorded = await completeJob(ctx, claimed, completion);
  if (!isRecorded) return { kind: "stale" };
  if (completion.kind === "succeeded") return { kind: "succeeded" };
  if (completion.kind === "retry") return { kind: "retried", error: completion.error, runAt: completion.runAt };
  return { kind: "failed", error: completion.error };
}

/** Throws on a queue without a handler: the caller claims only queues it has handlers for. */
function getHandler(handlers: JobHandlers, queue: string): AnyJobHandler {
  const handler = Object.hasOwn(handlers, queue) ? handlers[queue] : undefined;
  if (handler === undefined) throw new Error(`@softure-ai/jobs: no handler for queue "${queue}"`);
  return handler;
}

function isOk(result: unknown): boolean {
  return typeof result === "object" && result !== null && (result as { ok?: unknown }).ok === true;
}

interface ReadFailure {
  readonly error: string;
  readonly retry?: boolean;
  readonly retryAfterSeconds?: number;
}

/** The failure a handler returned, with a code fit for `last_error`; null when the value is not a failure at all. */
function readFailure(result: unknown): ReadFailure | null {
  if (typeof result !== "object" || result === null) return null;
  const candidate = result as { ok?: unknown; error?: unknown; retry?: unknown; retryAfterSeconds?: unknown };
  if (candidate.ok !== false || typeof candidate.error !== "string") return null;
  return {
    error: toErrorCode(candidate.error),
    retry: candidate.retry === false ? false : undefined,
    retryAfterSeconds: typeof candidate.retryAfterSeconds === "number" && Number.isFinite(candidate.retryAfterSeconds) ? candidate.retryAfterSeconds : undefined,
  };
}

function toErrorCode(error: string): ErrorCode {
  const trimmed = error.slice(0, MAX_ERROR_LENGTH);
  return (trimmed.includes(".") && trimmed.length > 0 ? trimmed : HANDLER_THREW) as ErrorCode;
}
