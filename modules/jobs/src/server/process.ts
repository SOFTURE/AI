// One attempt of one claimed job: parse the payload with the handler's schema, run the handler, record the outcome
// (fenced by the claim). Shared by the worker and `runDueJobs`, so tests run the production path.
import type { ErrorCode } from "@softure-ai/core";
import type { JobOutcome } from "../contract.js";
import type { AnyJobHandler, JobHandlers, JobRunResult } from "../handlers.js";
import { isJobCancelled, JobCancelledError, jobProgressSchema, type JobProgress } from "../progress.js";
import { jobRunSummarySchema, type JobRunSummary } from "../summary.js";
import type { ClaimedJob, Completion } from "./claim.js";
import { recordCompletion, writeJobProgress } from "./claim.js";
import { clampRetrySeconds, getRetryDelaySeconds } from "./backoff.js";
import type { JobsContext } from "./context.js";
import type { JobsLogger } from "./logger.js";
import { getJobsOptions, getQueue } from "./options.js";
import { logRunEnd } from "./run-log.js";

const INVALID_PAYLOAD = "jobs.invalid_payload";
const HANDLER_THREW = "jobs.handler_threw";
const MAX_ERROR_LENGTH = 200;
/** At most one progress write per job in this window. */
const PROGRESS_INTERVAL_MS = 1000;
/** A result reference: an identifier of the app's row, never free text. */
const RESULT_REF = /^[A-Za-z0-9_.:/-]{1,200}$/;

export interface RunClaimedJobOptions {
  readonly handlers: JobHandlers;
  readonly logger: JobsLogger;
  /**
   * Aborted when the job is taken from the handler (shutdown after the grace period, lost lease), or with a
   * `JobCancelledError` when an operator cancelled it: the attempt is then recorded `cancelled`.
   */
  readonly signal: AbortSignal;
  /** In [0, 1): the jitter of the retry delay. */
  readonly random: () => number;
}

/** Runs the handler once for a claimed job and records what happened. Database failures propagate. */
export async function runClaimedJob(ctx: JobsContext, claimed: ClaimedJob, options: RunClaimedJobOptions): Promise<JobOutcome> {
  const { job } = claimed;
  const startedAt = ctx.clock.now();
  const fields = { queue: job.queue, jobId: job.id, attempt: job.attempts };
  const handler = getHandler(options.handlers, job.queue);

  const payload = handler.payload.safeParse(job.payload);
  if (!payload.success) {
    // Paths only: the values are the app's data.
    const paths = payload.error.issues.map((issue) => issue.path.map(String).join(".") || "(root)").join(", ");
    options.logger.warn("job payload does not match its handler's schema; failed without running", { ...fields, paths });
    return record(ctx, claimed, { kind: "failed", error: INVALID_PAYLOAD, isPermanent: true }, { logger: options.logger, startedAt });
  }

  // The handler's own signal: follows the caller's, and also aborts when a progress write sees a cancel request.
  const controller = new AbortController();
  const follow = () => controller.abort(options.signal.reason);
  if (options.signal.aborted) follow();
  else options.signal.addEventListener("abort", follow, { once: true });
  const progress = createProgressReporter(ctx, claimed, { logger: options.logger, controller });

  let result: JobRunResult;
  try {
    result = await handler.run(payload.data as never, { ...ctx, job, signal: controller.signal, reportProgress: progress.report });
  } catch (error) {
    if (!isJobCancelled(controller.signal)) options.logger.error("job handler threw", { ...fields, error });
    result = { ok: false, error: HANDLER_THREW };
  }
  await progress.flush();
  options.signal.removeEventListener("abort", follow);
  if (isJobCancelled(controller.signal)) {
    // Whatever the handler returned after the request, the job ends cancelled.
    return record(ctx, claimed, { kind: "cancelled" }, { logger: options.logger, startedAt });
  }
  if (controller.signal.aborted) {
    // The job was released or taken over while the handler ran; the fenced write below would be refused anyway.
    return { kind: "stale" };
  }
  return record(ctx, claimed, decide(ctx, claimed, result, options), { logger: options.logger, startedAt });
}

interface ProgressReporter {
  /** `context.reportProgress`. */
  readonly report: (progress: JobProgress) => Promise<void>;
  /** Writes a report the throttle still holds and stops its timer; called when the handler returned. */
  readonly flush: () => Promise<void>;
}

/**
 * `context.reportProgress`: checks the progress and writes at most once per `PROGRESS_INTERVAL_MS`; a report inside the
 * window is held and written when the window ends (or the handler returns), replaced by any newer one. A write that
 * sees a cancel request aborts the handler. Never throws into the handler: an invalid progress or a failed write is
 * logged.
 */
function createProgressReporter(
  ctx: JobsContext,
  claimed: ClaimedJob,
  options: { readonly logger: JobsLogger; readonly controller: AbortController },
): ProgressReporter {
  const fields = { queue: claimed.job.queue, jobId: claimed.job.id };
  let lastWriteAt = Number.NEGATIVE_INFINITY;
  let held: JobProgress | undefined;
  let timer: NodeJS.Timeout | undefined;

  const write = async (progress: JobProgress) => {
    lastWriteAt = ctx.clock.now().getTime();
    try {
      const state = await writeJobProgress(ctx, claimed, progress);
      if (state === "cancel_requested" && !options.controller.signal.aborted) options.controller.abort(new JobCancelledError());
    } catch (error) {
      options.logger.warn("could not store job progress", { ...fields, error });
    }
  };
  const flush = async () => {
    clearTimeout(timer);
    timer = undefined;
    const progress = held;
    held = undefined;
    if (progress !== undefined) await write(progress);
  };

  const report = async (progress: JobProgress) => {
    const parsed = jobProgressSchema.safeParse(progress);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.map(String).join(".") || "(root)").join(", ");
      options.logger.warn("job progress does not match the progress schema; not stored", { ...fields, paths });
      return;
    }
    const waitMs = lastWriteAt + PROGRESS_INTERVAL_MS - ctx.clock.now().getTime();
    if (waitMs > 0) {
      held = parsed.data;
      // A timer per window, not per report: the newest held report is written when it fires.
      timer ??= setTimeout(() => void flush(), waitMs);
      return;
    }
    held = undefined;
    clearTimeout(timer);
    timer = undefined;
    await write(parsed.data);
  };
  return { report, flush };
}

function decide(ctx: JobsContext, claimed: ClaimedJob, result: unknown, options: RunClaimedJobOptions): Completion {
  const { job } = claimed;
  if (isOk(result)) return { kind: "succeeded", summary: readSummary(result, claimed, options), resultRef: readResultRef(result, claimed, options) };
  const failure = readFailure(result);
  if (failure === null) {
    options.logger.error("job handler returned neither ok() nor an error; treated as a throw", { queue: job.queue, jobId: job.id });
  }
  const error = failure?.error ?? HANDLER_THREW;
  if (failure?.pauseQueueSeconds !== undefined) {
    const seconds = clampRetrySeconds(failure.pauseQueueSeconds);
    return { kind: "paused", error, seconds, runAt: new Date(ctx.clock.now().getTime() + Math.round(seconds * 1000)) };
  }
  if (failure?.retry === false) return { kind: "failed", error, isPermanent: true };
  if (job.attempts >= job.maxAttempts) return { kind: "failed", error };
  const queue = getQueue(getJobsOptions(ctx.config), job.queue);
  const delaySeconds =
    failure?.retryAfterSeconds === undefined
      ? getRetryDelaySeconds(queue.backoff, job.attempts, options.random)
      : clampRetrySeconds(failure.retryAfterSeconds);
  return { kind: "retry", error, runAt: new Date(ctx.clock.now().getTime() + Math.round(delaySeconds * 1000)) };
}

interface RecordOptions {
  readonly logger: JobsLogger;
  /** When the attempt started, for the duration in the success line. */
  readonly startedAt: Date;
}

/**
 * Writes the outcome (fenced by the claim; a retry of a job an operator cancelled becomes `cancelled`) and logs what was
 * recorded; a refused write is `stale` and leaves no line.
 */
async function record(ctx: JobsContext, claimed: ClaimedJob, requested: Completion, options: RecordOptions): Promise<JobOutcome> {
  const { logger } = options;
  const completion = await recordCompletion(ctx, claimed, requested, { logger });
  if (completion === null) return { kind: "stale" };
  const { job } = claimed;
  const base = { queue: job.queue, jobId: job.id, attempt: job.attempts };
  const { logRuns } = getJobsOptions(ctx.config);
  if (completion.kind === "succeeded") {
    const durationMs = ctx.clock.now().getTime() - options.startedAt.getTime();
    logRunEnd(logger, logRuns, { ...base, outcome: "succeeded", origin: job.origin, durationMs, summary: completion.summary ?? null });
    return { kind: "succeeded" };
  }
  if (completion.kind === "retry") {
    logRunEnd(logger, logRuns, { ...base, outcome: "retried", code: completion.error, runAt: completion.runAt });
    return { kind: "retried", error: completion.error, runAt: completion.runAt };
  }
  if (completion.kind === "paused") {
    logRunEnd(logger, logRuns, { ...base, outcome: "retried", code: completion.error, runAt: completion.runAt });
    return { kind: "paused", error: completion.error, runAt: completion.runAt };
  }
  if (completion.kind === "cancelled") {
    logRunEnd(logger, logRuns, { ...base, outcome: "cancelled" });
    return { kind: "cancelled" };
  }
  logRunEnd(logger, logRuns, { ...base, outcome: "failed", code: completion.error });
  return { kind: "failed", error: completion.error };
}

/**
 * The checked summary of `ok({ summary })`; null without one (`ok()`, a value of the handler's own). An invalid summary
 * is dropped with a warning naming its paths, never its values: the job did its work and stays succeeded.
 */
function readSummary(result: unknown, claimed: ClaimedJob, options: RunClaimedJobOptions): JobRunSummary | null {
  const value = (result as { value?: unknown }).value;
  if (typeof value !== "object" || value === null || !Object.hasOwn(value, "summary")) return null;
  const parsed = jobRunSummarySchema.safeParse((value as { summary: unknown }).summary);
  if (parsed.success) return parsed.data;
  const paths = parsed.error.issues.map((issue) => issue.path.map(String).join(".") || "(root)").join(", ");
  options.logger.warn("job summary does not match the summary schema; recorded without it", { queue: claimed.job.queue, jobId: claimed.job.id, paths });
  return null;
}

/**
 * The checked result reference of `ok({ resultRef })`; null without one. One that is not an identifier is dropped with
 * a warning, never logged itself: the job did its work and stays succeeded.
 */
function readResultRef(result: unknown, claimed: ClaimedJob, options: RunClaimedJobOptions): string | null {
  const value = (result as { value?: unknown }).value;
  if (typeof value !== "object" || value === null || !Object.hasOwn(value, "resultRef")) return null;
  const resultRef = (value as { resultRef: unknown }).resultRef;
  if (resultRef === undefined || resultRef === null) return null;
  if (typeof resultRef === "string" && RESULT_REF.test(resultRef)) return resultRef;
  options.logger.warn("job result reference is not an identifier; recorded without it", { queue: claimed.job.queue, jobId: claimed.job.id });
  return null;
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
  readonly pauseQueueSeconds?: number;
}

/** The failure a handler returned, with a code fit for `last_error`; null when the value is not a failure at all. */
function readFailure(result: unknown): ReadFailure | null {
  if (typeof result !== "object" || result === null) return null;
  const candidate = result as { ok?: unknown; error?: unknown; retry?: unknown; retryAfterSeconds?: unknown; pauseQueueSeconds?: unknown };
  if (candidate.ok !== false || typeof candidate.error !== "string") return null;
  return {
    error: toErrorCode(candidate.error),
    retry: candidate.retry === false ? false : undefined,
    retryAfterSeconds: readSeconds(candidate.retryAfterSeconds),
    pauseQueueSeconds: readSeconds(candidate.pauseQueueSeconds),
  };
}

function readSeconds(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toErrorCode(error: string): ErrorCode {
  const trimmed = error.slice(0, MAX_ERROR_LENGTH);
  return (trimmed.includes(".") && trimmed.length > 0 ? trimmed : HANDLER_THREW) as ErrorCode;
}
