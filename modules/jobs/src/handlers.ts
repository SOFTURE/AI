// Job handlers: what a worker runs for each queue. A handler names the zod schema of its payload, so the data read
// back from the table is checked at the boundary before the handler sees it.
import type { Clock, ErrorCode, Ok, SoftureConfig } from "@softure-ai/core";
import type { Queryable } from "@softure-ai/db";
import type { z } from "zod";
import type { Job, JobFailure } from "./contract.js";

/** What a handler receives besides its payload. */
export interface JobHandlerContext {
  /** The worker's database: not a transaction; open one with `db.transaction` when the work needs it. */
  readonly db: Queryable;
  readonly clock: Clock;
  readonly config: SoftureConfig;
  /** The job as claimed: `attempts` is this attempt's number, starting at 1. */
  readonly job: Job;
  /**
   * Aborted when the job is taken away from this handler: the worker stops and its grace period ended, or the lease
   * could not be extended. Pass it to `fetch` and other cancellable calls; whatever the handler returns afterwards is
   * not recorded.
   */
  readonly signal: AbortSignal;
}

/**
 * What a handler returns: `ok()` when the work is done; an `Err` to try again with the queue's backoff (until the
 * attempts are used up); `failJob(code)` to fail for good; `retryJobLater(code, seconds)` to try again after a delay
 * the handler chooses. A throw is retried like an `Err` with the code `jobs.handler_threw` and logged.
 */
export type JobRunResult = Ok<unknown> | JobFailure;

export interface JobHandler<TPayload = unknown> {
  /** The schema of the payload; a payload that does not match fails the job with `jobs.invalid_payload`, untried. */
  readonly payload: z.ZodType<TPayload>;
  readonly run: (payload: TPayload, context: JobHandlerContext) => Promise<JobRunResult>;
}

/**
 * A handler of any payload type, as a handler map holds it. `run` takes `never` so every `JobHandler<T>` fits; the
 * runner passes it the payload its own schema parsed.
 */
export interface AnyJobHandler {
  readonly payload: z.ZodType;
  readonly run: (payload: never, context: JobHandlerContext) => Promise<JobRunResult>;
}

/** Handlers by queue name. Every queue a worker runs needs one; a handler for an unknown queue is refused. */
export type JobHandlers = Readonly<Record<string, AnyJobHandler>>;

/**
 * Defines a handler with its payload type inferred from the schema:
 *
 *   export const replyHandler = defineJobHandler({
 *     payload: z.object({ messageId: z.string() }),
 *     run: async ({ messageId }, { db }) => { ...; return ok(); },
 *   });
 */
export function defineJobHandler<TSchema extends z.ZodType>(handler: {
  readonly payload: TSchema;
  readonly run: (payload: z.output<TSchema>, context: JobHandlerContext) => Promise<JobRunResult>;
}): JobHandler<z.output<TSchema>> {
  if (typeof handler.run !== "function") {
    throw new Error("defineJobHandler: run must be a function");
  }
  return handler as JobHandler<z.output<TSchema>>;
}

/** A failure that is not retried: the job is `failed` at once with this code. */
export function failJob<E extends ErrorCode>(error: E): JobFailure {
  return { ok: false, error, retry: false };
}

/**
 * A failure retried after `seconds` instead of the queue's backoff (a provider's `Retry-After`). Still counts as an
 * attempt: after the last one the job is `failed`.
 */
export function retryJobLater<E extends ErrorCode>(error: E, seconds: number): JobFailure {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError(`retryJobLater: seconds must be a finite number >= 0, got ${String(seconds)}`);
  }
  return { ok: false, error, retryAfterSeconds: seconds };
}
